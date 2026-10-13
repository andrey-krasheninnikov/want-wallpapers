import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Preview } from '@/data/previews';
import type { Locale } from '@/data/catalog';
import { interfaceCopy } from '@/data/interface-copy';

export function CoverMedia({ image, alt, src, priority = false }: { image: Preview; alt: string; src?: string; priority?: boolean }) {
  return <div className="reveal-media" data-reveal>
    <img src={image.src} width={image.width} height={image.height} alt={alt} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} className="gallery-image" />
    {src && <video data-cover-video data-src={src} muted playsInline loop preload="none" aria-hidden="true" hidden className="absolute inset-0 size-full object-cover" />}
  </div>;
}
export function CoverControl({ locale }: { locale: Locale }) {
  const ui = interfaceCopy[locale];
  return <Button type="button" variant="secondary" size="icon" hidden data-playing="false" data-cover-control data-pause-label={ui.pauseCover} data-play-label={ui.playCover} aria-label={ui.pauseCover} className="absolute top-3 right-3">
    <Pause data-cover-pause aria-hidden="true" /><Play data-cover-play aria-hidden="true" />
  </Button>;
}
