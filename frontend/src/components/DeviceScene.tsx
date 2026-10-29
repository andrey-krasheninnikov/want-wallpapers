import { trackProductEvent, captureProductEvents } from '@/lib/analytics';
import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import type { ModelViewerElement } from '@google/model-viewer';
import { Button } from '@want-foundation/desyst-react';
import { designCopy } from '@/data/design-copy';
import type { Locale } from '@/data/catalog';
import { useGalleryData } from '@/lib/use-gallery-data';
import { deviceModelSrc, createWallpaperCycle } from '@/lib/device-wallpaper';
import type { Preview } from '@/data/previews';

const initialOrbit = '12deg 83deg auto';

type SceneWallpaper = { id: string; desktop: Preview; mobile: Preview; title: string; description: string; href: string };

export default function DeviceScene({ locale, items: initialItems, initialId, dataUrl }: {
  locale: Locale; items: SceneWallpaper[]; initialId: string; dataUrl: string;
}) {
  const { data } = useGalleryData(dataUrl, locale);
  const items = useMemo(() => data ? [...initialItems, ...data.wallpapers.filter(item => !initialItems.some(initial => initial.id === item.id))] : initialItems, [data, initialItems]);
  const text = designCopy[locale];
  const host = useRef<HTMLDivElement>(null);
  const model = useRef<ModelViewerElement | null>(null);
  const stage = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(Math.max(0, items.findIndex((item) => item.id === initialId)));
  const current = useRef(index);
  const changing = useRef(false);
  const cycle = useRef(createWallpaperCycle(initialId));
  const screenTextures = useRef<ReturnType<ModelViewerElement['createCanvasTexture']>[]>([]);
  const [textureError, setTextureError] = useState('');
  const { desktop, mobile, title, description, href } = items[index];
  const [paused, setPaused] = useState(false);
  const [activation, activate] = useState(1);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!activation) return;
    let active = true;
    let removeListeners = () => {};
    setReady(false); setFailed(false);
    void import('../lib/device-scene-startup').then(({ failedDeviceScenes }) => {
      if (!active || !host.current) return;
      const viewer = host.current.querySelector<ModelViewerElement>('model-viewer');
      if (!viewer) { setFailed(true); return; }
      model.current = viewer;
      const loaded = () => {
        void changeWallpaper(current.current).then((loaded) => { if (active) { setReady(loaded); setFailed(!loaded); } });
      };
      const failed = () => { if (active) { trackProductEvent('media_error', { media: 'model' }); setReady(false); setFailed(true); } };
      viewer.addEventListener('load', loaded, { once: true });
      viewer.addEventListener('error', failed);
      removeListeners = () => { viewer.removeEventListener('load', loaded); viewer.removeEventListener('error', failed); };
      if (failedDeviceScenes.has(viewer)) failed();
      else if (viewer.loaded) { viewer.removeEventListener('load', loaded); loaded(); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; removeListeners(); model.current = null; screenTextures.current = []; changing.current = false; };
  }, [activation, text.scene]);

  useEffect(() => {
    if (!ready || !model.current || !stage.current) return;
    const viewer = model.current;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      viewer.autoRotate = visible && !document.hidden && !motion.matches && !paused;
      if (viewer.autoRotate && timer === undefined) timer = setInterval(() => void changeWallpaper(undefined, true), 1000);
      if (!viewer.autoRotate) { clearInterval(timer); timer = undefined; }
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(stage.current);
    document.addEventListener('visibilitychange', update); motion.addEventListener('change', update); update();
    return () => { clearInterval(timer); viewer.autoRotate = false; observer.disconnect(); document.removeEventListener('visibilitychange', update); motion.removeEventListener('change', update); };
  }, [ready, paused, items, text.textureFailed]);

  async function changeWallpaper(selected?: number, automatic = false) {
    const viewer = model.current;
    if (!viewer?.model || (selected === undefined && items.length < 2) || changing.current) return false;
    const nextId = selected === undefined ? cycle.current.next(items.map(item => item.id), items[current.current].id) : items[selected]?.id;
    const next = items.findIndex(item => item.id === nextId);
    if (next < 0) return false;
    changing.current = true;
    try {
      const urls = [items[next].desktop.src, items[next].mobile.src];
      const images = await Promise.all(urls.map(async (src) => {
        const image = new Image(); image.src = src; await image.decode(); return image;
      }));
      if (model.current !== viewer || (automatic && !viewer.autoRotate)) return false;
      const desktopMaterial = viewer.model.materials.find((material) => material.name === 'Desktop wallpaper');
      const mobileMaterial = viewer.model.materials.find((material) => material.name === 'Mobile wallpaper');
      if (!desktopMaterial || !mobileMaterial) throw new Error('Missing screen material');
      // Reuse two fixed-size textures instead of allocating GPU textures every second.
      const textures = screenTextures.current.length ? screenTextures.current : images.map((image) => {
        const texture = viewer.createCanvasTexture();
        const canvas = texture.source.element as HTMLCanvasElement;
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        return texture;
      });
      const surfaces = textures.map((texture) => {
        const canvas = texture.source.element as HTMLCanvasElement;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Missing screen canvas');
        return { canvas, context };
      });
      textures.forEach((texture, index) => {
        const { canvas, context } = surfaces[index];
        // Canvas textures flip Y; counter that for the glTF screen UVs.
        context.setTransform(1, 0, 0, -1, 0, canvas.height);
        context.drawImage(images[index], 0, 0, canvas.width, canvas.height);
        texture.name = urls[index]; texture.source.update();
      });
      desktopMaterial.pbrMetallicRoughness.baseColorTexture.setTexture(textures[0]);
      mobileMaterial.pbrMetallicRoughness.baseColorTexture.setTexture(textures[1]);
      screenTextures.current = textures;
      cycle.current.commit(items[next].id);
      current.current = next; setIndex(next); setTextureError('');
      return true;
    } catch { if (model.current === viewer) { cycle.current.reject(items[next].id); trackProductEvent('media_error', { media: 'image' }); setTextureError(text.textureFailed); } return false; }
    finally { if (model.current === viewer) changing.current = false; }
  }

  useEffect(() => {
    const viewer = model.current;
    if (!ready || !viewer) return;
    let timer: ReturnType<typeof setTimeout>;
    const change = (event: Event) => {
      if ((event as CustomEvent<{ source: string }>).detail.source !== 'user-interaction') return;
      const track = captureProductEvents();
      clearTimeout(timer); timer = setTimeout(() => { track('feature_action', { feature: 'scene', action: 'rotate' }); void changeWallpaper(); }, 200);
    };
    viewer.addEventListener('camera-change', change);
    return () => { clearTimeout(timer); viewer.removeEventListener('camera-change', change); };
  }, [ready, items, text.textureFailed]);

  function rotate(direction: number) {
    const viewer = model.current;
    if (!viewer || !ready) return;
    trackProductEvent('feature_action', { feature: 'scene', action: 'rotate' });
    setPaused(true);
    const orbit = viewer.getCameraOrbit();
    const theta = Math.max(-35 * Math.PI / 180, Math.min(35 * Math.PI / 180, orbit.theta + direction * Math.PI / 12));
    viewer.cameraOrbit = `${theta}rad ${orbit.phi}rad ${orbit.radius}m`;
    if (Math.abs(theta - orbit.theta) > .001) void changeWallpaper();
  }

  return <figure ref={stage} className="device-stage" data-scene-wallpaper={items[index].id} data-scene-state={failed ? 'failed' : ready ? 'ready' : activation ? 'loading' : 'poster'}>
    <div className="device-canvas">
      <a href={href} aria-label={title} className="device-poster">
        <span className="device-monitor"><img src={desktop.src} width={desktop.width} height={desktop.height} alt={description} fetchPriority="high" /></span>
        <span className="device-phone"><img src={mobile.src} width={mobile.width} height={mobile.height} alt="" /></span>
      </a>
      <div ref={host} className="device-model" data-visible={!failed && (ready || initialId === 'neon-tide-5')} aria-hidden={failed || (!ready && initialId !== 'neon-tide-5')}>
        {createElement('model-viewer', {
          key: activation, src: activation > 1 ? `${deviceModelSrc}&attempt=${activation}` : deviceModelSrc,
          loading: 'eager', alt: text.scene, 'ar-status': 'not-presenting', 'camera-controls': '', 'camera-orbit': initialOrbit,
          'rotation-per-second': '5deg', 'auto-rotate-delay': '0', 'shadow-intensity': '1', exposure: '1',
          'touch-action': 'pan-y', 'disable-pan': '', 'disable-zoom': '', 'interaction-prompt': 'none',
          'min-camera-orbit': '-35deg 55deg auto', 'max-camera-orbit': '35deg 100deg auto',
        }, <span slot="pan-target" hidden />)}
      </div>
    </div>
    <figcaption className="device-caption"><a href={href}>{title}</a><div className="device-controls">
      {ready && <Button variant="secondary" size="icon" aria-label={text.left} onClick={() => rotate(-1)}><RotateCcw aria-hidden="true" /></Button>}
      <Button variant="secondary" size="sm" aria-label={ready ? text.reset : failed ? text.retry : text.loading} disabled={Boolean(activation && !ready && !failed)} onClick={() => { trackProductEvent('feature_action', { feature: 'scene', action: ready ? 'reset' : 'retry' }); if (ready && model.current) { model.current.cameraOrbit = initialOrbit; model.current.resetTurntableRotation(); } else activate(value => value + 1); }}>
        <Box data-icon="inline-start" aria-hidden="true" /><span className={ready ? "hidden sm:inline" : undefined}>{ready ? text.reset : failed ? text.retry : activation ? text.loading : text.view}</span>
      </Button>
      {ready && <Button variant="secondary" size="icon" aria-label={paused ? text.playScene : text.pauseScene} aria-pressed={paused} onClick={() => { trackProductEvent('feature_action', { feature: 'scene', action: paused ? 'play' : 'pause' }); setPaused(value => !value); }}>{paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}</Button>}
      {ready && <Button variant="secondary" size="icon" aria-label={text.right} onClick={() => rotate(1)}><RotateCw aria-hidden="true" /></Button>}
    </div></figcaption>
    <p className="device-message" role="status" aria-live="polite" hidden={!failed && !textureError}>{failed ? text.failed : textureError}</p>
  </figure>;
}
