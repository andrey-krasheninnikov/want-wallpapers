import { trackProductEvent } from '@/lib/analytics';
import { carouselScroll, scrollCarousel } from '@/lib/carousel-scroll';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@want-foundation/desyst-react';
import { CollectionCard, type CollectionCardData } from './Gallery';
import { designCopy } from '@/data/design-copy';
import type { Locale } from '@/data/catalog';

export default function CollectionCarousel({ items, locale }: { items: CollectionCardData[]; locale: Locale }) {
  return <div data-collection-carousel><Carousel count={items.length} label={designCopy[locale].collections} previousLabel={designCopy[locale].previousCollections} nextLabel={designCopy[locale].nextCollections}>
    {items.map(item => <CollectionCard key={item.href} item={item} />)}
  </Carousel></div>;
}

export function Carousel({ count: itemCount, label, previousLabel, nextLabel, children }: {
  count: number; label: string; previousLabel: string; nextLabel: string; children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ page: 1, pages: 1 });
  const step = useRef(0);
  useEffect(() => {
    const element = track.current!;
    let previousPage = 1, geometry = '';
    const update = (fromScroll = false) => {
      const card = element.querySelector('article')?.getBoundingClientRect();
      if (!card) return;
      const style = getComputedStyle(element);
      const gap = parseFloat(style.columnGap);
      const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const count = Math.max(1, Math.round((width + gap) / (card.width + gap)));
      step.current = count * (card.width + gap);
      const pages = Math.max(1, Math.ceil(itemCount / count));
      const { offset, max } = carouselScroll(element);
      const atEnd = offset >= max - 2;
      const page = atEnd ? pages : Math.min(pages, Math.round(offset / step.current) + 1);
      const nextGeometry = `${width}/${card.width}/${gap}`;
      // Resizing can also emit scroll; changed geometry only updates pagination.
      if (fromScroll && geometry === nextGeometry && previousPage !== page) trackProductEvent('feature_action', { feature: 'carousel', action: page > previousPage ? 'next' : 'previous' });
      previousPage = page; geometry = nextGeometry;
      setPosition({ page, pages });
    };
    const observer = new ResizeObserver(() => update());
    const scroll = () => update(true);
    observer.observe(element); element.addEventListener('scroll', scroll, { passive: true }); update();
    return () => { observer.disconnect(); element.removeEventListener('scroll', scroll); };
  }, [itemCount]);
  function move(direction: number) {
    const element = track.current!;
    scrollCarousel(element, (position.page - 1 + direction) * step.current);
  }
  return <div className="collection-carousel">
    <div ref={track} className="collection-track" role="region" tabIndex={0} aria-label={label}>{children}</div>
    <nav className="carousel-pagination shell" aria-label={label}>
      <Button variant="secondary" size="icon" disabled={position.page === 1} onClick={() => move(-1)} aria-label={previousLabel}><ArrowLeft aria-hidden="true" /></Button>
      <output dir="ltr" aria-live="polite">{position.page} / {position.pages}</output>
      <Button variant="secondary" size="icon" disabled={position.page === position.pages} onClick={() => move(1)} aria-label={nextLabel}><ArrowRight aria-hidden="true" /></Button>
    </nav>
  </div>;
}
