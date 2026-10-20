import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { designCopy } from '@/data/design-copy';
import type { Locale } from '@/data/catalog';

export type Navigation = {
  previous: { href: string; title: string } | null;
  next: { href: string; title: string } | null;
  position: number | null; total: number;
};
export function WallpaperNavigationLink({ locale, item, direction, variant = 'desktop', navigate }: {
  locale: Locale; item: NonNullable<Navigation['previous']>; direction: 'previous' | 'next';
  variant?: 'desktop' | 'mobile'; navigate?: (direction: 'previous' | 'next') => void;
}) {
  return <Button asChild variant="secondary" size="icon"><a href={`${item.href}?variant=${variant}#wallpaper-view`}
    data-wallpaper-previous={direction === 'previous' ? '' : undefined} data-wallpaper-next={direction === 'next' ? '' : undefined}
    aria-label={`${designCopy[locale][direction]}: ${item.title}`} onClick={event => {
      if (navigate && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(direction); }
    }}>{direction === 'previous' ? <ArrowLeft aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}</a></Button>;
}
export function WallpaperNavigation({ locale, navigation, variant = 'desktop', navigate }: {
  locale: Locale; navigation: Navigation; variant?: 'desktop' | 'mobile'; navigate?: (direction: 'previous' | 'next') => void;
}) {
  return <nav className="wallpaper-nav" aria-label={designCopy[locale].gallery}>
    {navigation.previous && <WallpaperNavigationLink locale={locale} item={navigation.previous} direction="previous" variant={variant} navigate={navigate} />}
    <span className="wallpaper-position" aria-live="polite">{navigation.position === null ? '' : `${navigation.position.toLocaleString(locale)} / ${navigation.total.toLocaleString(locale)}`}</span>
    {navigation.next && <WallpaperNavigationLink locale={locale} item={navigation.next} direction="next" variant={variant} navigate={navigate} />}
  </nav>;
}
