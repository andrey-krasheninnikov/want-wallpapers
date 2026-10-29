import { trackProductEvent } from '@/lib/analytics';
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@want-foundation/desyst-react';
import { Card } from '@want-foundation/desyst-react';
import { copy } from '@/data/copy';
import { designCopy } from '@/data/design-copy';
import type { Locale } from '@/data/catalog';
import { useGalleryData } from '@/lib/use-gallery-data';
import { initialMosaic, nextMosaic, hoverMosaic, type MosaicFrame, type MosaicTile, type MosaicWallpaper } from '@/lib/home-mosaic';

function loadPreview(src: string, signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      image.onload = image.onerror = null;
      resolve(loaded);
    };
    const abort = () => { finish(false); image.removeAttribute('src'); };
    const timer = setTimeout(() => finish(false), 8000);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    image.onload = () => { void image.decode().then(() => finish(true), () => finish(false)); };
    image.onerror = () => finish(false);
    image.src = src;
  });
}

export function MosaicCard({ tile, previous, locale }: { tile: MosaicTile; previous?: MosaicTile; locale: Locale }) {
  return <article data-wallpaper-card={tile.id} data-ga={tile.collection && tile.category ? `${tile.collection}/${tile.category}` : undefined} data-mosaic-variant={tile.variant}>
          <Card className="group gallery-card">
            <a href={tile.href + (tile.variant === 'mobile' ? '?variant=mobile' : '')} aria-label={`${tile.title} (${copy[locale][tile.variant]})`}>
              <img src={tile[tile.variant].src} width={tile[tile.variant].width} height={tile[tile.variant].height} alt={tile.description} loading="lazy" data-mosaic-image className="gallery-image" />
              {previous && previous[previous.variant].src !== tile[tile.variant].src && <img src={previous[previous.variant].src} width={previous[previous.variant].width} height={previous[previous.variant].height} alt="" aria-hidden="true" className="gallery-image mosaic-image-outgoing" />}
            </a>
          </Card>
  </article>;
}

export default function HomeMosaic({ items: initialItems, locale, dataUrl }: { items: MosaicWallpaper[]; locale: Locale; dataUrl?: string }) {
  const { data, failed: dataFailed } = useGalleryData(dataUrl, locale);
  const items = data?.wallpapers ?? initialItems;
  const catalogReady = !dataUrl || !!data;
  const host = useRef<HTMLElement>(null);
  const [frame, setFrame] = useState(() => initialMosaic(items));
  const current = useRef(frame);
  const grid = useRef<HTMLDivElement>(null);
  const previousRects = useRef<DOMRect[]>([]);
  const animations = useRef<Animation[]>([]);
  const failed = useRef(new Set<string>());
  const [outgoing, setOutgoing] = useState<MosaicFrame | null>(null);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(true);
  const text = designCopy[locale];

  useLayoutEffect(() => {
    const elements = [...(grid.current?.children ?? [])] as HTMLElement[];
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
    const after = elements.map(element => element.getBoundingClientRect());
    if (!reduced) elements.forEach((element, index) => {
      const before = previousRects.current[index], next = after[index];
      if (!before || !next?.width || !next.height) return;
      animations.current.push(element.animate([
        { transform: `translate(${before.x - next.x}px, ${before.y - next.y}px) scale(${before.width / next.width}, ${before.height / next.height})`, transformOrigin: 'top left' },
        { transform: 'none', transformOrigin: 'top left' },
      ], { duration: 360, easing: 'cubic-bezier(.32,.72,0,1)' }));
    });
    previousRects.current = [];
  }, [frame, reduced]);

  React.useEffect(() => {
    const root = host.current;
    if (!root) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = matchMedia('(hover: hover) and (pointer: fine)');
    const controller = new AbortController();
    let alive = true, visible = false, pageActive = true, hovered = root.matches(':hover'), version = 0;
    let repairing = false, repairVersion = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hoverTimer: ReturnType<typeof setTimeout> | undefined;
    let hoveredTile: Element | null = null;
    const available = () => items.filter(item => ![item.desktop.src, item.mobile.src].every(src => failed.current.has(src)));
    const allowed = (hover = false) => catalogReady && alive && pageActive && visible && !document.hidden && !motion.matches && !paused && (!hovered || hover) && !root.contains(document.activeElement);
    const stop = () => { clearTimeout(timer); timer = undefined; ++version; };
    function schedule() {
      stop();
      if (!repairing && allowed() && available().length > 1) timer = setTimeout(() => { void change(); }, 3000);
    }
    async function prepare(tile: MosaicTile): Promise<MosaicTile | undefined> {
      for (const variant of [tile.variant, tile.variant === 'mobile' ? 'desktop' : 'mobile'] as const) {
        const src = tile[variant].src;
        if (failed.current.has(src)) continue;
        if (await loadPreview(src, controller.signal)) return { ...tile, variant };
        if (controller.signal.aborted) return;
        failed.current.add(src);
      }
    }
    async function change(repair = false, hoverId?: string) {
      // Repair must survive visibility and focus changes during hydration.
      const request = repair ? ++repairVersion : ++version;
      if (repair) repairing = true;
      let pool = available();
      while (pool.length) {
        const candidate = hoverId ? hoverMosaic(pool, current.current, hoverId) : nextMosaic(pool, current.current);
        if (!candidate) { schedule(); return; }
        const prepared = await Promise.all(candidate.tiles.map((tile, index) => hoverId && tile === current.current.tiles[index] ? tile : prepare(tile)));
        if (!alive || request !== (repair ? repairVersion : version)) return;
        if (prepared.every((tile): tile is MosaicTile => !!tile)) {
          if (!repair && !allowed(!!hoverId)) return;
          previousRects.current = repair || motion.matches ? [] : [...(grid.current?.children ?? [])].map(element => element.getBoundingClientRect());
          setOutgoing(repair || motion.matches ? null : current.current);
          current.current = { ...candidate, tiles: prepared };
          setFrame(current.current);
          repairing = false;
          schedule();
          return;
        }
        pool = available();
      }
      repairing = false;
      if (repair) {
        current.current = { layout: 0, tiles: [] };
        setFrame(current.current);
        observer?.disconnect();
      }
      schedule();
    }
    const update = () => {
      if (!alive) return;
      setReduced(motion.matches);
      if (motion.matches) setOutgoing(null);
      clearTimeout(hoverTimer);
      schedule();
    };
    const enter = () => { hovered = true; update(); };
    const leave = () => { hovered = false; hoveredTile = null; clearTimeout(hoverTimer); update(); };
    const hover = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !pointer.matches) return;
      const tile = (event.target as Element).closest('[data-wallpaper-card]');
      if (tile === hoveredTile) return;
      hoveredTile = tile; clearTimeout(hoverTimer); stop();
      if (repairing || !tile || !allowed(true)) return;
      const id = tile.getAttribute('data-wallpaper-card')!;
      hoverTimer = setTimeout(() => { if (pointer.matches && allowed(true)) void change(false, id); }, 250);
    };
    const focusOut = () => queueMicrotask(update);
    const imageError = (event: Event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.hasAttribute('data-mosaic-image')) return;
      failed.current.add(image.getAttribute('src')!);
      if (catalogReady || dataFailed) { stop(); void change(true); }
    };
    const hide = () => { pageActive = false; clearTimeout(hoverTimer); stop(); };
    const show = () => { pageActive = true; update(); };
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; update(); });
    observer?.observe(root);
    root.addEventListener('mouseenter', enter); root.addEventListener('mouseleave', leave);
    root.addEventListener('pointermove', hover);
    root.addEventListener('focusin', update); root.addEventListener('focusout', focusOut);
    root.addEventListener('error', imageError, true);
    pointer.addEventListener('change', update);
    motion.addEventListener('change', update); document.addEventListener('visibilitychange', update);
    window.addEventListener('pagehide', hide); window.addEventListener('pageshow', show);
    setReady(true); update();
    const broken = [...root.querySelectorAll<HTMLImageElement>('[data-mosaic-image]')].filter(image => image.complete && !image.naturalWidth);
    if (broken.length && (catalogReady || dataFailed)) {
      broken.forEach(image => failed.current.add(image.getAttribute('src')!));
      if (catalogReady || dataFailed) { stop(); void change(true); }
    }
    const dispose = () => {
      alive = false; stop(); clearTimeout(hoverTimer); controller.abort(); observer?.disconnect();
      animations.current.forEach(animation => animation.cancel()); animations.current = [];
      root.removeEventListener('mouseenter', enter); root.removeEventListener('mouseleave', leave);
      root.removeEventListener('pointermove', hover);
      root.removeEventListener('focusin', update); root.removeEventListener('focusout', focusOut);
      root.removeEventListener('error', imageError, true);
      pointer.removeEventListener('change', update);
      motion.removeEventListener('change', update); document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show);
      document.removeEventListener('astro:before-swap', dispose);
    };
    document.addEventListener('astro:before-swap', dispose);
    return dispose;
  }, [items, paused, catalogReady, dataFailed]);

  if (!frame.tiles.length) return null;
  return <section ref={host} className="shell section-space home-mosaic-section" data-home-mosaic aria-label={copy[locale].latest}>
    <div className="home-mosaic-stage">
      <div ref={grid} className="home-mosaic" data-layout={frame.layout} data-count={frame.tiles.length} onAnimationEnd={event => { if (event.animationName === 'mosaic-fade') setOutgoing(null); }}>
        {frame.tiles.map((tile, index) => <MosaicCard key={index} tile={tile} previous={outgoing?.tiles[index]} locale={locale} />)}
      </div>
      <Button className="mosaic-toggle" variant="secondary" size="icon" hidden={!ready || reduced || items.length < 2} aria-label={paused ? text.playMosaic : text.pauseMosaic} aria-pressed={paused} onClick={() => { trackProductEvent('feature_action', { feature: 'mosaic', action: paused ? 'play' : 'pause' }); setPaused(value => !value); }}>
        {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      </Button>
    </div>
  </section>;
}
