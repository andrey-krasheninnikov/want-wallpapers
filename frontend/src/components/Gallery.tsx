import { ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Fragment } from 'react';
import type { Preview } from '@/data/previews';

export type WallpaperCardData = {
  id: string; href: string; title: string; description: string;
  collectionTitle: string; number: number; image: Preview;
  category: string; collection: string; searchText: string;
};
export type CollectionCardData = {
  href: string; title: string; description: string; countLabel: string; image?: Preview;
};

export function WallpaperCard({ item, headingLevel = 3 }: { item: WallpaperCardData; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return <article className="min-w-0" data-wallpaper-card={item.id}>
    <Card className="group gallery-card">
      <a href={item.href} className="block h-full rounded-xl">
        <div className="overflow-hidden bg-background"><img src={item.image.src} width={item.image.width} height={item.image.height} alt={item.description} loading="lazy" className="gallery-image" /></div>
        <CardContent className="flex items-start justify-between gap-4 p-4 sm:p-5">
          <div className="min-w-0"><Heading className="text-base leading-snug font-semibold">{item.title}</Heading><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.collectionTitle}</p></div>
          <span className="pt-0.5 text-sm text-muted-foreground" aria-hidden="true">{String(item.number).padStart(2, '0')}</span>
        </CardContent>
      </a>
    </Card>
  </article>;
}

export function CollectionCard({ item, headingLevel = 3 }: { item: CollectionCardData; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return <article className="min-w-0">
    <Card className="group gallery-card">
      <a href={item.href} className="flex h-full flex-col rounded-xl">
        {item.image && <img src={item.image.src} width={item.image.width} height={item.image.height} alt={item.description} loading="lazy" className="gallery-image" />}
        <CardContent className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><Heading className="text-xl leading-snug font-semibold tracking-tight">{item.title}</Heading><ArrowUpRight className="mt-1 size-5 shrink-0 text-link" aria-hidden="true" /></div>
          <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          <Badge variant="secondary" className="mt-auto w-fit">{item.countLabel}</Badge>
        </CardContent>
      </a>
    </Card>
  </article>;
}

export function WallpaperGrid({ items, headingLevel = 3 }: { items: WallpaperCardData[]; headingLevel?: 2 | 3 }) {
  return <div className="gallery-grid">{items.map((item) => <WallpaperCard key={item.id} item={item} headingLevel={headingLevel} />)}</div>;
}

export function CollectionGrid({ items, headingLevel = 3 }: { items: CollectionCardData[]; headingLevel?: 2 | 3 }) {
  return <div className="gallery-grid">{items.map((item) => <CollectionCard key={item.href} item={item} headingLevel={headingLevel} />)}</div>;
}

export function Crumbs({ items, label }: { items: { href?: string; title: string }[]; label: string }) {
  return <Breadcrumb aria-label={label}><BreadcrumbList className="gap-2 break-words">
    {items.map((item, index) => <Fragment key={index}>
      {index > 0 && <BreadcrumbSeparator />}
      <BreadcrumbItem>{item.href ? <BreadcrumbLink href={item.href}>{item.title}</BreadcrumbLink> : <BreadcrumbPage>{item.title}</BreadcrumbPage>}</BreadcrumbItem>
    </Fragment>)}
  </BreadcrumbList></Breadcrumb>;
}

export function ActionLink({ href, label, variant = 'default' }: { href: string; label: string; variant?: 'default' | 'outline' | 'ghost' }) {
  return <Button asChild variant={variant} size="lg"><a href={href}>{label}<ArrowUpRight aria-hidden="true" /></a></Button>;
}
