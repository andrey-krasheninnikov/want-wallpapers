import { useEffect, useRef } from 'react';
import { interfaceCopy } from '@/data/interface-copy';
import type { Locale } from '@/data/catalog';
import { getCountry, initializePrivacy, readCookiePreferences } from '@/lib/privacy';
import { selectAdvertisingProvider, startAdvertisement, type AdvertisingProvider, type MountAdvertisement } from '@/lib/advertising';

export default function WallpaperAdvertisements({ locale, mount }: { locale: Locale; mount?: MountAdvertisement }) {
  const left = useRef<HTMLElement>(null), right = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mount || /^\/admin(?:\/|$)/.test(window.location.pathname)) return;
    const mountPlacement = mount;
    const media = window.matchMedia('(min-width: 1712px)');
    let ready = false, active = true;
    let provider: AdvertisingProvider | null = null;
    let stops: (() => void)[] = [];
    function stop() { for (const dispose of stops) dispose(); stops = []; }
    function update() {
      const selected = ready && media.matches ? selectAdvertisingProvider(getCountry(), readCookiePreferences()) : null;
      if (selected === provider) return;
      stop(); provider = selected;
      if (selected && left.current && right.current) {
        stops = [startAdvertisement(left.current, selected, 'left', mountPlacement), startAdvertisement(right.current, selected, 'right', mountPlacement)];
      }
    }
    window.addEventListener('want:privacy', update);
    media.addEventListener('change', update);
    void initializePrivacy().then(() => { if (active) { ready = true; update(); } });
    return () => {
      active = false;
      window.removeEventListener('want:privacy', update);
      media.removeEventListener('change', update);
      stop();
    };
  }, [mount]);
  // Mount only an explicitly supplied placement integration.
  if (!mount) return null;
  const label = interfaceCopy[locale].advertisement;
  return <>
    <aside ref={left} hidden className="wallpaper-advertisement" data-side="left" aria-label={label}><p className="mb-2 text-sm text-muted-foreground">{label}</p></aside>
    <aside ref={right} hidden className="wallpaper-advertisement" data-side="right" aria-label={label}><p className="mb-2 text-sm text-muted-foreground">{label}</p></aside>
  </>;
}
