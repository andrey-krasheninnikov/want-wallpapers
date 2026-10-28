import { ArrowUpRight } from 'lucide-react';
import { MediaCard, Card, CardContent } from '@want-foundation/desyst-react';
import { Badge } from '@want-foundation/desyst-react';
import { Button } from '@want-foundation/desyst-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@want-foundation/desyst-react';
import { Fragment } from 'react';
import { CoverMedia, CoverControl } from './CollectionCover';
import type { Locale } from '@/data/catalog';
import type { Preview } from '@/data/previews';

export type WallpaperCardData = {
  id: string; href: string; title: string; description: string;
  collectionTitle: string; number: number; image: Preview;
  category: string; collection: string; searchText: string;
};
export type CollectionCardData = {
  href: string; title: string; description: string; countLabel: string; image?: Preview; video?: string; locale: Locale;
};

export function WallpaperCard({ item, headingLevel = 3 }: { item: WallpaperCardData; headingLevel?: 2 | 3 }) {
  return <div data-wallpaper-card={item.id} data-ga={`${item.collection}/${item.category}`}>
    <MediaCard href={item.href} title={item.title} caption={item.collectionTitle} index={item.number}
      headingLevel={headingLevel} image={{ src: item.image.src, width: item.image.width, height: item.image.height, alt: item.description }} />
  </div>;
}

export function CollectionCard({ item, headingLevel = 3 }: { item: CollectionCardData; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return <article className="min-w-0" data-collection-card={item.href}>
    <Card className="group gallery-card relative" data-collection-cover>
      <a href={item.href} className="collection-card-link">
        {item.image && <CoverMedia image={item.image} alt={item.description} src={item.video} listingId={item.href} />}
        <CardContent className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><Heading className="text-xl leading-snug font-semibold tracking-tight">{item.title}</Heading><ArrowUpRight className="mt-1 size-5 shrink-0 text-link" aria-hidden="true" /></div>
          <p className="collection-card-description text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          <Badge variant="secondary" className="mt-auto w-fit" data-collection-count={item.href}>{item.countLabel}</Badge>
        </CardContent>
      </a>
      {item.video && <CoverControl locale={item.locale} />}
    </Card>
  </article>;
}

export function WallpaperGrid({ items, headingLevel = 3 }: { items: WallpaperCardData[]; headingLevel?: 2 | 3 }) {
  return <div className="gallery-grid">{items.map((item) => <WallpaperCard key={item.id} item={item} headingLevel={headingLevel} />)}</div>;
}

export function CollectionGrid({ items, headingLevel = 3 }: { items: CollectionCardData[]; headingLevel?: 2 | 3 }) {
  return <div className="collection-grid">{items.map((item) => <CollectionCard key={item.href} item={item} headingLevel={headingLevel} />)}</div>;
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
