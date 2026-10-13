import { createRoot } from 'react-dom/client';
import WallpaperAdvertisements from '../../src/components/WallpaperAdvertisements';
import WallpaperView from '../../src/components/WallpaperView';
import CookieConsent from '../../src/components/CookieConsent';
import SocialPanel from '../../src/components/SocialPanel';
import { wallpapers, type Locale } from '../../src/data/catalog';
import { copy } from '../../src/data/copy';
import type { MountAdvertisement } from '../../src/lib/advertising';

declare global {
  interface Window {
    advertisingFixture: { calls: string[]; cancelled: string[]; disposed: string[]; finish: () => void; unmount: () => void };
  }
}
const query = new URLSearchParams(location.search);
const locale = (['ru', 'en', 'zh-cn', 'pt-br'].find((value) => value === query.get('locale')) ?? 'en') as Locale;
const mode = query.get('mode');
const pending: (() => void)[] = [];
const fixture = window.advertisingFixture = { calls: [] as string[], cancelled: [] as string[], disposed: [] as string[], finish: () => { for (const finish of pending.splice(0)) finish(); }, unmount: () => {} };
const mount: MountAdvertisement = async ({ provider, side, container, signal }) => {
  const name = `${provider}:${side}`;
  fixture.calls.push(name);
  signal.addEventListener('abort', () => { fixture.cancelled.push(name); }, { once: true });
  if (mode === 'error') throw new Error('Blocked fixture');
  if (mode === 'no-fill') return null;
  if (mode === 'pending') await new Promise<void>((resolve) => { pending.push(resolve); });
  if (!signal.aborted) {
    container.textContent = `Test placement: ${name}`;
    container.style.height = '600px';
    container.style.background = 'var(--muted)';
  }
  return () => { fixture.disposed.push(name); container.replaceChildren(); };
};
const wallpaper = wallpapers.find((value) => value.slug === 'contours-of-silence-1')!;
const variants = {
  desktop: { src: '/previews/contours-of-silence-1-desktop.webp', width: 1280, height: 720, download: '/downloads/contours-of-silence-1-desktop.png', original: '/downloads/contours-of-silence-1-desktop.png', originalWidth: 1672, originalHeight: 941 },
  mobile: { src: '/previews/contours-of-silence-1-mobile.webp', width: 640, height: 1384, download: '/downloads/contours-of-silence-1-mobile.png', original: '/downloads/contours-of-silence-1-mobile.png', originalWidth: 853, originalHeight: 1844 },
};
const root = createRoot(document.getElementById('fixture')!);
fixture.unmount = () => root.unmount();
root.render(<>
  <main className="shell"><h1>{wallpaper.title[locale]}</h1>
    <section className="wallpaper-advertising-layout" aria-label={wallpaper.title[locale]}>
      <WallpaperAdvertisements locale={locale} mount={mount} />
      <WallpaperView locale={locale} id={wallpaper.id} description={wallpaper.description[locale]} variants={variants} tags={[]} />
    </section>
    <SocialPanel id={wallpaper.id} locale={locale} />
  </main>
  <footer className="shell"><a data-cookie-settings href="/cookies/">{copy[locale].cookieSettings}</a></footer>
  <CookieConsent locale={locale} analyticsAvailable={false} />
</>);
