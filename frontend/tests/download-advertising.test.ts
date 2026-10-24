import { expect, test } from 'bun:test';
import { rememberDownload, takeDownload, validDownload, videoUrl, type WallpaperDownload } from '../src/lib/download-advertising';
import { hilltopVideoAdvertisement } from '../src/lib/advertising-providers';

const download: WallpaperDownload = { href: '/downloads/fixture-mobile.png', filename: 'fixture-mobile.png', wallpaper: 'fixture', variant: 'mobile' };
test('pending downloads accept only matching native PNG paths and variants', () => {
  expect(validDownload(download)).toBe(true);
  for (const patch of [{ href: 'https://example.com/file.png' }, { href: '//example.com/file.png' }, { href: '/downloads/../file.png' },
    { href: '/downloads/fixture-mobile.png?redirect=evil' }, { filename: 'other.png' }, { variant: 'desktop' }, { wallpaper: null }]) {
    expect(validDownload({ ...download, ...patch })).toBe(false);
  }
  expect(validDownload(null)).toBe(false);
});
test('consent reload resumes an action once and rejects expired or malformed storage', () => {
  const values = new Map<string, string>();
  Object.assign(globalThis, { sessionStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } });
  expect(rememberDownload(download)).toBe(true); expect(takeDownload()).toEqual(download); expect(takeDownload()).toBeNull();
  for (const raw of ['invalid', 'null', JSON.stringify({ download, expires: Date.now() - 1 }), JSON.stringify({ download, expires: Date.now() + 1000000 })]) {
    values.set('want-pending-download-v1', raw); expect(takeDownload()).toBeNull(); expect(values.size).toBe(0);
  }
  Object.assign(globalThis, { sessionStorage: { getItem: () => { throw new Error('Blocked'); }, setItem: () => { throw new Error('Blocked'); } } });
  expect(rememberDownload(download)).toBe(false); expect(takeDownload()).toBeNull();
  Reflect.deleteProperty(globalThis, 'sessionStorage');
});
test('video URLs reject unreviewed destinations, credentials and executable schemes', () => {
  Object.assign(globalThis, { window: { location: { origin: 'https://wallpapers.want.foundation' } } });
  expect(videoUrl(hilltopVideoAdvertisement.src)).toBe(hilltopVideoAdvertisement.src);
  expect(videoUrl('/fixture.mp4')).toBe('https://wallpapers.want.foundation/fixture.mp4');
  for (const url of ['javascript:alert(1)', 'data:video/mp4,test', 'http://loyal-product.com/vast', 'https://loyal-product.com.evil/vast',
    'https://user:password@loyal-product.com/vast', 'https://127.0.0.1/vast', 'https://example.com/video.mp4']) expect(() => videoUrl(url)).toThrow();
  Reflect.deleteProperty(globalThis, 'window');
});
