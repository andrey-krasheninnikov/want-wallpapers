import { trackProductEvent } from '@/lib/analytics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Skeleton } from './ui/skeleton';
import { copy } from '@/data/copy';
import { downloadCopy } from '@/data/download-copy';
import { localeDirection, type Locale } from '@/data/catalog';
import { advertisingRequested, hilltopVideoAdvertisement } from '@/lib/advertising-providers';
import { getCookiePreferences } from '@/lib/privacy';
import { notifyDownload, rememberDownload, startDownload, takeDownload, type WallpaperDownload as DownloadRequest } from '@/lib/download-advertising';

type Pending = { download: DownloadRequest; controller: AbortController };

export function WallpaperDownload({ locale, wallpaper, variant, href, enabled = hilltopVideoAdvertisement.enabled }: {
  locale: Locale; wallpaper: string; variant: 'desktop' | 'mobile'; href: string; enabled?: boolean;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [playing, setPlaying] = useState(false);
  const active = useRef<Pending | null>(null);
  const trigger = useRef<HTMLAnchorElement>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const text = downloadCopy[locale];
  const finish = useCallback((request: Pending, native = false) => {
    if (active.current !== request) return;
    active.current = null; request.controller.abort('dismissed'); setPending(null);
    if (native) notifyDownload(request.download); else startDownload(request.download);
  }, []);
  useEffect(() => {
    const resumed = takeDownload(); if (resumed) startDownload(resumed);
    const withdraw = () => {
      const request = active.current;
      if (!request || getCookiePreferences().advertising) return;
      if (advertisingRequested() && rememberDownload(request.download)) {
        active.current = null; request.controller.abort(); setPending(null);
      } else finish(request);
    };
    window.addEventListener('want:privacy', withdraw, true);
    return () => { window.removeEventListener('want:privacy', withdraw, true); active.current?.controller.abort(); active.current = null; };
  }, [finish]);
  useEffect(() => {
    if (!pending || !video) return;
    const element = video;
    const timer = setTimeout(() => finish(pending), 10000);
    const ready = () => { clearTimeout(timer); setPlaying(true); trackProductEvent('advertising_stage', { placement: 'video', stage: 'play' }); };
    element.addEventListener('playing', ready);
    void import('@/lib/vast-video').then(({ playVideoAdvertisement }) => playVideoAdvertisement(element, pending.controller.signal,
      () => getCookiePreferences().advertising)).then(() => { trackProductEvent('advertising_stage', { placement: 'video', stage: 'complete' }); finish(pending); }, () => { if (!pending.controller.signal.aborted) trackProductEvent('advertising_stage', { placement: 'video', stage: 'error' }); finish(pending); });
    return () => { clearTimeout(timer); element.removeEventListener('playing', ready); pending.controller.abort(); };
  }, [pending, video, finish]);
  return <>
    <Button asChild size="lg" className="w-full"><a ref={trigger} id="download-link" href={href} download={href.split('/').at(-1)} onClick={event => {
      trackProductEvent('download_click', { item_id: wallpaper, variant });
      const download: DownloadRequest = { href, filename: href.split('/').at(-1)!, wallpaper, variant };
      if (active.current) { event.preventDefault(); return; }
      if (!enabled || !getCookiePreferences().advertising || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        notifyDownload(download); return;
      }
      event.preventDefault();
      const request = { download, controller: new AbortController() };
      trackProductEvent('advertising_stage', { placement: 'video', stage: 'request' });
      active.current = request; setPlaying(false); setPending(request);
    }}><Download data-icon="inline-start" aria-hidden="true" />{copy[locale].download} · {copy[locale][variant]}</a></Button>
    <Dialog open={pending !== null} onOpenChange={open => { if (!open && active.current) { trackProductEvent('advertising_stage', { placement: 'video', stage: 'dismiss' }); finish(active.current); } }}>
      <DialogContent className="w-[calc(100%_-_2rem)]" dir={localeDirection(locale)} closeLabel={text.close} onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}>
        <DialogHeader><DialogTitle>{text.title}</DialogTitle><DialogDescription>{text.description}</DialogDescription></DialogHeader>
        <div className="relative aspect-video overflow-hidden rounded-panel bg-media-ground" aria-busy={!playing}>
          {!playing && <Skeleton className="absolute inset-0 size-full animate-none" role="status" aria-label={text.loading} />}
          <video ref={setVideo} muted playsInline controls preload="none" className="size-full object-contain" aria-label={text.title} />
        </div>
        {pending && <Button asChild><a href={pending.download.href} download={pending.download.filename} onClick={() => finish(pending, true)}>{text.download}</a></Button>}
      </DialogContent>
    </Dialog>
  </>;
}
