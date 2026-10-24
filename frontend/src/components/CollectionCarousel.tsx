import { trackProductEvent } from '@/lib/analytics';
import { carouselScroll, scrollCarousel } from '@/lib/carousel-scroll';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const previousPage = useRef(1);
  useEffect(() => {
    if (previousPage.current !== position.page) trackProductEvent('feature_action', { feature: 'carousel', action: position.page > previousPage.current ? 'next' : 'previous' });
    previousPage.current = position.page;
  }, [position.page]);
  useEffect(() => {
    const element = track.current!;
    const update = () => {
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
      setPosition({ page: atEnd ? pages : Math.min(pages, Math.round(offset / step.current) + 1), pages });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element); element.addEventListener('scroll', update, { passive: true }); update();
    return () => { observer.disconnect(); element.removeEventListener('scroll', update); };
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
