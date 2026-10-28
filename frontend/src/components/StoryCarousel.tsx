import { trackProductEvent } from '@/lib/analytics';
import React, { useRef, useState } from 'react';
import { Carousel } from './CollectionCarousel';
import { Dialog, DialogContent, DialogTitle } from '@want-foundation/desyst-react';
import { Button } from '@want-foundation/desyst-react';
import { copy } from '@/data/copy';
import { interfaceCopy } from '@/data/interface-copy';
import { storyCopy } from '@/data/story-copy';
import type { Locale } from '@/data/catalog';
import { useGalleryData } from '@/lib/use-gallery-data';

export default function StoryCarousel({ locale, dataUrl, count, children }: {
  locale: Locale; dataUrl: string; count: number; children: React.ReactNode;
}) {
  const { data, failed } = useGalleryData(dataUrl, locale);
  const [selected, setSelected] = useState<{ slug: string; title: string; href: string } | null>(null);
  const trigger = useRef<HTMLAnchorElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const text = storyCopy[locale];
  const story = selected ? data?.stories[selected.slug] : undefined;
  function open(event: React.MouseEvent) {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[data-story]') : null;
    if (!anchor || anchor.target || anchor.download) return;
    event.preventDefault();
    trackProductEvent('feature_action', { feature: 'story', action: 'open', item_id: anchor.dataset.story });
    trigger.current = anchor;
    setSelected({ slug: anchor.dataset.story!, title: anchor.querySelector('h3')!.textContent!, href: anchor.href });
  }
  return <div data-story-carousel onClick={open}>
    <Carousel count={count} label={text.title} previousLabel={text.previous} nextLabel={text.next}>{children}</Carousel>
    <Dialog open={!!selected} onOpenChange={open => { if (!open) { trackProductEvent('feature_action', { feature: 'story', action: 'close', item_id: selected?.slug }); setSelected(null); } }}>
      {selected && <DialogContent className="story-dialog" closeLabel={interfaceCopy[locale].close} aria-describedby={undefined}
        onOpenAutoFocus={event => { event.preventDefault(); title.current?.focus({ preventScroll: true }); }}
        onCloseAutoFocus={event => { event.preventDefault(); if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true }); }}>
        <DialogTitle ref={title} tabIndex={-1} className="section-title pe-10">{selected.title}</DialogTitle>
        {story ? <div className="story-dialog-reading">
          {story.image && <img src={story.image.src} width={story.image.width} height={story.image.height} alt="" className="story-dialog-cover" />}
          {story.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div> : <p role="status">{failed || data ? text.failed : text.loading}</p>}
        <Button asChild className="w-fit"><a href={selected.href}>{copy[locale].viewCollection}</a></Button>
      </DialogContent>}
    </Dialog>
  </div>;
}
