import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { copy, localPath } from '@/data/copy';
import { designCopy } from '@/data/design-copy';
import { selectedWallpaperVariant, wallpaperSlideHref } from '@/lib/wallpaper-navigation';
import type { WallpaperVariant } from '@/data/previews';
import type { Locale } from '@/data/catalog';

type Neighbor = { href: string; title: string } | null;

export default function WallpaperView({ locale, id, description, variants, tags, navigation }: {
  locale: Locale; id: string; description: string;
  variants: Record<'desktop' | 'mobile', WallpaperVariant>; tags: { title: string; href: string }[];
  navigation: { previous: Neighbor; next: Neighbor; position: number; total: number };
}) {
  const ui = copy[locale];
  const text = designCopy[locale];
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
  function direction(value: 'previous' | 'next') {
    try { window.sessionStorage.setItem('want-wallpaper-direction', value); } catch {}
  }
  function navigate(value: 'previous' | 'next') {
    const item = navigation[value];
    if (!item) return;
    direction(value);
    window.location.assign(wallpaperSlideHref(item.href, variant));
  }
  const image = variants[variant];
  return <Tabs value={variant} onValueChange={changeVariant} className="block"><div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-8" data-wallpaper-detail={id}>
    <div className="wallpaper-stage">
      <div id="wallpaper-view" className="wallpaper-preview" role="region" tabIndex={0} aria-label={text.gallery}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault(); navigate(event.key === 'ArrowLeft' ? 'previous' : 'next');
        }}
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
        {(['desktop', 'mobile'] as const).map((value) => <TabsContent key={value} value={value} forceMount data-variant={value} className="m-0"><img id={variant === value ? 'detail-image' : undefined} data-wallpaper-image={value} src={variants[value].src} width={variants[value].width} height={variants[value].height} alt={description} fetchPriority="high" draggable={false} /></TabsContent>)}
      </div>
      <nav className="wallpaper-nav" aria-label={text.gallery}>
        {navigation.previous && <Button asChild variant="secondary" size="icon"><a href={wallpaperSlideHref(navigation.previous.href, variant)} data-wallpaper-previous aria-label={`${text.previous}: ${navigation.previous.title}`} onClick={() => direction('previous')}><ArrowLeft aria-hidden="true" /></a></Button>}
        <span className="wallpaper-position" aria-live="polite">{navigation.position.toLocaleString(locale)} / {navigation.total.toLocaleString(locale)}</span>
        {navigation.next && <Button asChild variant="secondary" size="icon"><a href={wallpaperSlideHref(navigation.next.href, variant)} data-wallpaper-next aria-label={`${text.next}: ${navigation.next.title}`} onClick={() => direction('next')}><ArrowRight aria-hidden="true" /></a></Button>}
      </nav>
    </div>
    <Card className="gap-0 py-0 shadow-none lg:sticky lg:top-28"><CardContent className="grid gap-6 p-5 sm:p-6">
      <p className="text-base leading-relaxed text-muted-foreground">{description}</p>
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-background p-1">
        <TabsTrigger value="desktop" className="min-h-12 gap-2 whitespace-normal px-2 py-2 leading-snug"><Monitor className="size-4 shrink-0" aria-hidden="true" />{ui.desktop}</TabsTrigger>
        <TabsTrigger value="mobile" className="min-h-12 gap-2 whitespace-normal px-2 py-2 leading-snug"><Smartphone className="size-4 shrink-0" aria-hidden="true" />{ui.mobile}</TabsTrigger>
      </TabsList>
      <div className="grid gap-3">
        <form id="download-form" method="get" action={image.download} onSubmit={() => window.dispatchEvent(new CustomEvent('want:download', { detail: { wallpaper: id, variant } }))}><Button id="download-link" type="submit" size="lg" className="w-full"><Download aria-hidden="true" />{ui.download} · {ui[variant]}</Button></form>
        <noscript><form method="get" action={variants.mobile.download}><Button type="submit" variant="outline" className="w-full">{ui.mobile} · {ui.download}</Button></form></noscript>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{ui.formatHint}. <a className="text-link underline" href={localPath(locale, '/license/')}>{ui.license}</a></p>
      <div className="flex flex-wrap gap-2">{tags.map((tag) => <Badge key={tag.href} asChild variant="secondary" className="min-h-11 px-3 py-2 text-sm"><a href={tag.href}>{tag.title}</a></Badge>)}</div>
    </CardContent></Card>
  </div></Tabs>;
}
