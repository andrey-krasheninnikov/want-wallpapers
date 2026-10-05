import { useState } from 'react';
import { Download, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { copy, localPath } from '@/data/copy';
import type { WallpaperVariant } from '@/data/previews';
import type { Locale } from '@/data/catalog';

export default function WallpaperView({ locale, id, description, variants, tags }: {
  locale: Locale; id: string; description: string;
  variants: Record<'desktop' | 'mobile', WallpaperVariant>; tags: { title: string; href: string }[];
}) {
  const ui = copy[locale];
  const [variant, setVariant] = useState<'desktop' | 'mobile'>('desktop');
  const image = variants[variant];
  return <Tabs value={variant} onValueChange={(value) => setVariant(value as 'desktop' | 'mobile')} className="block"><div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-8" data-wallpaper-detail={id}>
    <div className="flex aspect-[4/3] max-h-[70dvh] items-center justify-center overflow-hidden rounded-xl border bg-card p-4 sm:p-6">
      {(['desktop', 'mobile'] as const).map((value) => <TabsContent key={value} value={value} className="m-0 flex h-full w-full items-center justify-center"><img id="detail-image" src={variants[value].src} width={variants[value].width} height={variants[value].height} alt={description} fetchPriority="high" className="h-full w-full object-contain" /></TabsContent>)}
    </div>
    <Card className="gap-0 py-0 shadow-none lg:sticky lg:top-28"><CardContent className="grid gap-6 p-5 sm:p-6">
      <p className="text-base leading-relaxed text-muted-foreground">{description}</p>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-background p-1">
          <TabsTrigger value="desktop" className="min-h-12 gap-2 whitespace-normal px-2 py-2 leading-snug"><Monitor className="size-4 shrink-0" aria-hidden="true" />{ui.desktop}</TabsTrigger>
          <TabsTrigger value="mobile" className="min-h-12 gap-2 whitespace-normal px-2 py-2 leading-snug"><Smartphone className="size-4 shrink-0" aria-hidden="true" />{ui.mobile}</TabsTrigger>
        </TabsList>
      <div className="grid gap-3">
        <form id="download-form" method="get" action={image.download} onSubmit={() => window.dispatchEvent(new CustomEvent('want:download', { detail: { wallpaper: id, variant } }))}><Button id="download-link" type="submit" size="lg" className="w-full"><Download aria-hidden="true" />{ui.download} · {ui[variant]}</Button></form>
        <details key={variant} className="original-preview"><summary>{ui.viewOriginal} · {ui[variant]}</summary><img src={image.original} width={image.originalWidth} height={image.originalHeight} alt={description} loading="lazy" /></details>
        <noscript><form method="get" action={variants.mobile.download}><Button type="submit" variant="outline" className="w-full">{ui.mobile} · {ui.download}</Button></form></noscript>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{ui.formatHint}. <a className="text-link underline" href={localPath(locale, '/license/')}>{ui.license}</a></p>
      <div className="flex flex-wrap gap-2">{tags.map((tag) => <Badge key={tag.href} asChild variant="outline" className="min-h-11 px-3 py-2 text-sm hover:bg-accent"><a href={tag.href}>{tag.title}</a></Badge>)}</div>
    </CardContent></Card>
  </div></Tabs>;
}
