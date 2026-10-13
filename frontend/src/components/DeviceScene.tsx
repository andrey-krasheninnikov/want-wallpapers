import { useEffect, useRef, useState } from 'react';
import { Box, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import type { ModelViewerElement } from '@google/model-viewer';
import { Button } from '@/components/ui/button';
import { designCopy } from '@/data/design-copy';
import type { Locale } from '@/data/catalog';
import type { Preview } from '@/data/previews';

const initialOrbit = '12deg 83deg auto';

export default function DeviceScene({ locale, desktop, mobile, title, description, href }: {
  locale: Locale; desktop: Preview; mobile: Preview; title: string; description: string; href: string;
}) {
  const text = designCopy[locale];
  const host = useRef<HTMLDivElement>(null);
  const model = useRef<ModelViewerElement | null>(null);
  const stage = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const [activation, activate] = useState(1);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!activation) return;
    let active = true;
    setReady(false); setFailed(false);
    void import('@google/model-viewer').then(() => {
      if (!active || !host.current) return;
      const viewer = document.createElement('model-viewer') as ModelViewerElement;
      viewer.loading = 'eager';
      viewer.setAttribute('rotation-per-second', '5deg');
      viewer.autoRotateDelay = 3000;
      // Failed model loads are cached by URL; retries need a fresh cache key.
      viewer.src = activation > 1 ? `/models/devices.glb?attempt=${activation}` : '/models/devices.glb';
      viewer.alt = text.scene;
      viewer.cameraControls = true;
      viewer.cameraOrbit = initialOrbit;
      viewer.shadowIntensity = 1;
      viewer.exposure = 1;
      viewer.setAttribute('touch-action', 'pan-y');
      viewer.setAttribute('disable-pan', '');
      const panTarget = document.createElement('span');
      panTarget.slot = 'pan-target'; panTarget.hidden = true;
      viewer.append(panTarget);
      viewer.setAttribute('disable-zoom', '');
      viewer.setAttribute('interaction-prompt', 'none');
      viewer.setAttribute('min-camera-orbit', '-35deg 55deg auto');
      viewer.setAttribute('max-camera-orbit', '35deg 100deg auto');
      viewer.addEventListener('load', () => { if (active) setReady(true); }, { once: true });
      viewer.addEventListener('error', () => { if (active) { setReady(false); setFailed(true); } });
      host.current.replaceChildren(viewer);
      model.current = viewer;
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; model.current?.remove(); model.current = null; };
  }, [activation, text.scene]);

  useEffect(() => {
    if (!ready || !model.current || !stage.current) return;
    const viewer = model.current;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const update = () => { viewer.autoRotate = visible && !document.hidden && !motion.matches && !paused; };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(stage.current);
    document.addEventListener('visibilitychange', update); motion.addEventListener('change', update); update();
    return () => { viewer.autoRotate = false; observer.disconnect(); document.removeEventListener('visibilitychange', update); motion.removeEventListener('change', update); };
  }, [ready, paused]);

  function rotate(direction: number) {
    const viewer = model.current;
    if (!viewer || !ready) return;
    setPaused(true);
    const orbit = viewer.getCameraOrbit();
    const theta = Math.max(-35 * Math.PI / 180, Math.min(35 * Math.PI / 180, orbit.theta + direction * Math.PI / 12));
    viewer.cameraOrbit = `${theta}rad ${orbit.phi}rad ${orbit.radius}m`;
  }

  return <figure ref={stage} className="device-stage" data-scene-state={failed ? 'failed' : ready ? 'ready' : activation ? 'loading' : 'poster'}>
    <div className="device-canvas">
      <a href={href} aria-label={title} className="device-poster" hidden={ready}>
        <span className="device-monitor"><img src={desktop.src} width={desktop.width} height={desktop.height} alt={description} fetchPriority="high" /></span>
        <span className="device-phone"><img src={mobile.src} width={mobile.width} height={mobile.height} alt="" /></span>
      </a>
      <div ref={host} className="device-model" data-ready={ready} aria-hidden={!ready} />
    </div>
    <figcaption className="device-caption"><a href={href}>{title}</a><div className="device-controls">
      {ready && <Button variant="secondary" size="icon" aria-label={text.left} onClick={() => rotate(-1)}><RotateCcw aria-hidden="true" /></Button>}
      <Button variant="secondary" size="sm" aria-label={ready ? text.reset : failed ? text.retry : text.loading} disabled={Boolean(activation && !ready && !failed)} onClick={() => ready && model.current ? (model.current.cameraOrbit = initialOrbit, model.current.resetTurntableRotation()) : activate((value) => value + 1)}>
        <Box data-icon="inline-start" aria-hidden="true" /><span className={ready ? "hidden sm:inline" : undefined}>{ready ? text.reset : failed ? text.retry : activation ? text.loading : text.view}</span>
      </Button>
      {ready && <Button variant="secondary" size="icon" aria-label={paused ? text.playScene : text.pauseScene} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}</Button>}
      {ready && <Button variant="secondary" size="icon" aria-label={text.right} onClick={() => rotate(1)}><RotateCw aria-hidden="true" /></Button>}
    </div></figcaption>
    <p className="device-message" role="status" aria-live="polite" hidden={!failed}>{failed ? text.failed : ''}</p>
  </figure>;
}
