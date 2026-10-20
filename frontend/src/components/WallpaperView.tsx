import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWallpaperSocial, WallpaperRatings, WallpaperComments } from '@/components/SocialPanel';
import { copy, localPath } from '@/data/copy';
import { designCopy } from '@/data/design-copy';
import { selectedWallpaperVariant, wallpaperSlideHref } from '@/lib/wallpaper-navigation';
import { yandexAdvertisingRequested } from '@/lib/advertising-providers';
import type { WallpaperVariant } from '@/data/previews';
import type { Locale } from '@/data/catalog';

type Neighbor = { href: string; title: string } | null;

export default function WallpaperView({ locale, id, description, variants, tags, navigation, children }: {
  locale: Locale; id: string; description: string; children?: React.ReactNode;
  variants: Record<'desktop' | 'mobile', WallpaperVariant>; tags: { title: string; href: string }[];
  navigation: { previous: Neighbor; next: Neighbor; position: number; total: number };
}) {
  const ui = copy[locale];
  const text = designCopy[locale];
  const social = useWallpaperSocial(id, locale);
  const [variant, setVariant] = useState<'desktop' | 'mobile'>('desktop');
  const pointer = React.useRef<{ x: number; y: number; id: number } | null>(null);
  useEffect(() => {
    const update = () => {
      const value = selectedWallpaperVariant(window.location.search);
      setVariant(value);
      document.documentElement.dataset.wallpaperVariant = value;
    };
    update();
    if (window.location.hash === '#wallpaper-view') document.getElementById('wallpaper-view')?.focus({ preventScroll: true });
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  function changeVariant(value: string) {
    if (value !== 'desktop' && value !== 'mobile') return;
    setVariant(value);
    document.documentElement.dataset.wallpaperVariant = value;
    const url = new URL(window.location.href);
    url.searchParams.set('variant', value);
    window.history.replaceState(window.history.state, '', url);
  }
  function navigate(value: 'previous' | 'next') {
    const item = navigation[value];
    if (!item) return;
    const href = wallpaperSlideHref(item.href, variant);
    if (yandexAdvertisingRequested()) { window.location.assign(href); return; }
    void import('astro:transitions/client').then(({ navigate }) => navigate(href.split('#')[0], { info: { wallpaperSlide: true } }));
  }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (document.querySelector('[role="dialog"][data-state="open"]') || window.getSelection()?.toString()) return;
      if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="tab"], [role="radio"], [role="slider"], [role="combobox"], [role="listbox"], [role="menu"], [data-comment-carousel]')) return;
      event.preventDefault(); navigate(event.key === 'ArrowLeft' ? 'previous' : 'next');
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [variant, navigation]);
  const image = variants[variant];
  return <Tabs value={variant} onValueChange={changeVariant} className="block"><div className="wallpaper-detail-grid" data-wallpaper-detail={id}>
    <div className="wallpaper-stage">
      <div id="wallpaper-view" className="wallpaper-preview wallpaper-detail-frame" role="region" tabIndex={0} aria-label={text.gallery}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return;
          pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
        }}
        onPointerCancel={() => { pointer.current = null; }}
        onPointerUp={(event) => {
          const start = pointer.current; pointer.current = null;
          if (!start || start.id !== event.pointerId) return;
          const x = event.clientX - start.x, y = event.clientY - start.y;
          if (Math.abs(x) < 48 || Math.abs(x) < Math.abs(y) * 1.5) return;
          navigate(x < 0 ? 'next' : 'previous');
        }}>
        {(['desktop', 'mobile'] as const).map((value) => <TabsContent key={value} value={value} forceMount data-variant={value} className="wallpaper-detail-variant"><img className="wallpaper-backdrop" src={variants[value].src} alt="" aria-hidden="true" draggable={false} /><img className="wallpaper-image" id={variant === value ? 'detail-image' : undefined} data-wallpaper-image={value} src={variants[value].src} width={variants[value].width} height={variants[value].height} alt={description} fetchPriority="high" draggable={false} /></TabsContent>)}
      </div>
      <nav className="wallpaper-nav" aria-label={text.gallery}>
        {navigation.previous && <Button asChild variant="secondary" size="icon"><a href={wallpaperSlideHref(navigation.previous.href, variant)} data-wallpaper-previous aria-label={`${text.previous}: ${navigation.previous.title}`} onClick={(event) => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('previous'); } }}><ArrowLeft aria-hidden="true" /></a></Button>}
        <span className="wallpaper-position" aria-live="polite">{navigation.position.toLocaleString(locale)} / {navigation.total.toLocaleString(locale)}</span>
        {navigation.next && <Button asChild variant="secondary" size="icon"><a href={wallpaperSlideHref(navigation.next.href, variant)} data-wallpaper-next aria-label={`${text.next}: ${navigation.next.title}`} onClick={(event) => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate('next'); } }}><ArrowRight aria-hidden="true" /></a></Button>}
      </nav>
    </div>
    <aside className="wallpaper-sidebar glass-surface">
      <div className="wallpaper-dock">
        <div className="wallpaper-dock-controls">
          <TabsList className="grid h-auto! w-full grid-cols-2 gap-1 bg-background p-1">
            <TabsTrigger value="desktop" className="wallpaper-variant-trigger"><Monitor aria-hidden="true" />{ui.desktop}</TabsTrigger>
            <TabsTrigger value="mobile" className="wallpaper-variant-trigger"><Smartphone aria-hidden="true" />{ui.mobile}</TabsTrigger>
          </TabsList>
          <div className="grid gap-3">
            <Button asChild size="lg" className="w-full"><a id="download-link" href={image.download} download={image.download.split('/').at(-1)} onClick={() => window.dispatchEvent(new CustomEvent('want:download', { detail: { wallpaper: id, variant } }))}><Download data-icon="inline-start" aria-hidden="true" />{ui.download} · {ui[variant]}</a></Button>
          </div>
        </div>
        <WallpaperRatings locale={locale} social={social} />
      </div>
      <div className="wallpaper-caption">
        <p className="text-base leading-relaxed text-muted-foreground">{description}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{ui.formatHint}. <a className="text-link underline" href={localPath(locale, '/license/')}>{ui.license}</a></p>
        <div className="flex flex-wrap gap-2">{tags.map((tag) => <Badge key={tag.href} asChild variant="outline" className="wallpaper-tag-link"><a href={tag.href}>{tag.title}</a></Badge>)}</div>
      </div>
    </aside>
    <WallpaperComments locale={locale} social={social} />
    {children}
  </div></Tabs>;
}
