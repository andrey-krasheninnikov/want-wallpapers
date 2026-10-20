import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CollectionCard, type CollectionCardData } from './Gallery';
import { designCopy } from '@/data/design-copy';
import type { Locale } from '@/data/catalog';

export default function CollectionCarousel({ items, locale }: { items: CollectionCardData[]; locale: Locale }) {
  const track = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ page: 1, pages: 1 });
  const step = useRef(0);
  useEffect(() => {
    const element = track.current!;
    const update = () => {
      const card = element.firstElementChild?.getBoundingClientRect();
      if (!card) return;
      const style = getComputedStyle(element);
      const gap = parseFloat(style.columnGap);
      const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const count = Math.max(1, Math.round((width + gap) / (card.width + gap)));
      step.current = count * (card.width + gap);
      const pages = Math.ceil(items.length / count);
      const atEnd = element.scrollLeft >= element.scrollWidth - element.clientWidth - 2;
      setPosition({ page: atEnd ? pages : Math.min(pages, Math.round(element.scrollLeft / step.current) + 1), pages });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element); element.addEventListener('scroll', update, { passive: true }); update();
    return () => { observer.disconnect(); element.removeEventListener('scroll', update); };
  }, [items.length]);
  function move(direction: number) {
    const element = track.current!;
    element.scrollTo({ left: Math.max(0, Math.min(element.scrollWidth - element.clientWidth, (position.page - 1 + direction) * step.current)), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  return <div className="collection-carousel" data-collection-carousel>
    <div ref={track} className="collection-track" role="region" tabIndex={0} aria-label={designCopy[locale].collections}>{items.map((item) => <CollectionCard key={item.href} item={item} />)}</div>
    <nav className="carousel-pagination shell" aria-label={designCopy[locale].collections}>
      <Button variant="secondary" size="icon" disabled={position.page === 1} onClick={() => move(-1)} aria-label={designCopy[locale].previousCollections}><ArrowLeft aria-hidden="true" /></Button>
      <output aria-live="polite">{position.page} / {position.pages}</output>
      <Button variant="secondary" size="icon" disabled={position.page === position.pages} onClick={() => move(1)} aria-label={designCopy[locale].nextCollections}><ArrowRight aria-hidden="true" /></Button>
    </nav>
  </div>;
}
