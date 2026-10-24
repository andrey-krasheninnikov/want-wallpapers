import { hilltopVideoAdvertisement } from './advertising-providers';

export type WallpaperDownload = { href: string; filename: string; wallpaper: string; variant: 'desktop' | 'mobile' };
const pendingKey = 'want-pending-download-v1';

export function validDownload(value: unknown): value is WallpaperDownload {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.href === 'string' && /^\/downloads\/[a-z0-9]+(?:-[a-z0-9]+)*-(desktop|mobile)\.png$/.test(item.href)
    && item.filename === item.href.split('/').at(-1) && typeof item.wallpaper === 'string'
    && (item.variant === 'desktop' || item.variant === 'mobile') && item.href.endsWith(`-${item.variant}.png`);
}

export function rememberDownload(download: WallpaperDownload): boolean {
  if (!validDownload(download)) return false;
  try { sessionStorage.setItem(pendingKey, JSON.stringify({ download, expires: Date.now() + 60000 })); return true; }
  catch { return false; }
}

export function takeDownload(): WallpaperDownload | null {
  try {
    const raw = sessionStorage.getItem(pendingKey); sessionStorage.removeItem(pendingKey);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return typeof value.expires === 'number' && value.expires > Date.now() && value.expires <= Date.now() + 60000
      && validDownload(value.download) ? value.download : null;
  } catch { return null; }
}

export function notifyDownload(download: WallpaperDownload) {
  window.dispatchEvent(new CustomEvent('want:download', { detail: { wallpaper: download.wallpaper, variant: download.variant } }));
}

export function startDownload(download: WallpaperDownload) {
  if (!validDownload(download)) return;
  const link = document.createElement('a'); link.href = download.href; link.download = download.filename;
  link.hidden = true; document.body.append(link); link.click(); link.remove(); notifyDownload(download);
}

// Keep the inspected feed and creative origins aligned with the wallpaper-only CSP.
export function videoUrl(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid video URL');
  const url = new URL(value, window.location.origin);
  if (url.username || url.password || (url.origin !== window.location.origin
    && (url.protocol !== 'https:' || ![new URL(hilltopVideoAdvertisement.src).origin, hilltopVideoAdvertisement.mediaOrigin].includes(url.origin)))) throw new Error('Unapproved video URL');
  return url.href;
}
