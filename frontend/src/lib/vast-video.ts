import { hilltopVideoAdvertisement } from './advertising-providers';
import { videoUrl } from './download-advertising';

export async function playVideoAdvertisement(video: HTMLVideoElement, signal: AbortSignal, allowed: () => boolean): Promise<void> {
  const active = () => !signal.aborted && allowed();
  const check = () => { signal.throwIfAborted(); if (!allowed()) throw new Error('Advertising denied'); };
  const { VASTClient, VASTTracker } = await import('@dailymotion/vast-client');
  check();
  const values = new Map<string, unknown>();
  const client = new VASTClient(0, 0, { storage: values, initStorage: () => values, isStorageDisabled: () => false,
    getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: unknown) => values.set(key, value),
    removeItem: (key: string) => values.delete(key), clear: () => values.clear() });
  const parser = client.getParser();
  // Parsing errors must not send tracking after withdrawal or to unapproved origins.
  const report = parser.trackVastError.bind(parser);
  const templates = <T,>(values: T[]): T[] => values.filter(value => {
    const url = typeof value === 'string' ? value : value && typeof value === 'object' && 'url' in value ? value.url : null;
    try { videoUrl(url); return true; } catch { return false; }
  });
  parser.trackVastError = (urls, code, ...details) => { if (active()) report(templates(urls), code, ...details); };
  let requests = 0;
  const response = await client.get(hilltopVideoAdvertisement.src, {
    resolveAll: false, allowMultipleAds: false, wrapperLimit: 5,
    urlHandler: { get: async (source: string) => {
      check(); if (++requests > 6) throw new Error('Too many VAST requests');
      const result = await fetch(videoUrl(source), { signal, credentials: 'omit', cache: 'no-store', redirect: 'error' });
      if (!result.ok || !result.body) throw new Error('VAST unavailable');
      const reader = result.body.getReader(); const decoder = new TextDecoder(); let xml = '', size = 0;
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break;
          size += chunk.value.byteLength; if (size > 1024 * 1024) throw new Error('VAST too large');
          xml += decoder.decode(chunk.value, { stream: true });
        }
        xml += decoder.decode();
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      check();
      const document = new DOMParser().parseFromString(xml, 'text/xml');
      if (document.querySelector('parsererror') || document.doctype) throw new Error('Invalid VAST');
      return { xml: document, details: { byteLength: size, statusCode: result.status } };
    } },
  });
  check();
  for (const ad of response.ads) for (const creative of ad.creatives) {
    if (creative.type !== 'linear' || creative.apiFramework || creative.interactiveCreativeFile
      || !Number.isFinite(creative.duration) || creative.duration <= 0) continue;
    const media = creative.mediaFiles.find((file: { apiFramework?: string; mimeType: string; fileURL: string; deliveryType: string }) => {
      try { videoUrl(file.fileURL); return !file.apiFramework && file.deliveryType === 'progressive'
        && ['video/mp4', 'video/webm'].includes(file.mimeType) && !!video.canPlayType(file.mimeType); } catch { return false; }
    });
    if (!media) continue;
    const tracker = new VASTTracker(null, ad, creative, null, true);
    const track = tracker.trackURLs.bind(tracker);
    tracker.trackURLs = (urls, macros, options) => { if (allowed() && (!signal.aborted || signal.reason === 'dismissed')) track(templates(urls), macros, options); };
    await new Promise<void>((resolve, reject) => {
      let started = false, finished = false;
      const finish = (error?: Error) => {
        if (finished) return; finished = true; clearTimeout(waiting);
        signal.removeEventListener('abort', abort);
        for (const [name, handler] of Object.entries(events)) video.removeEventListener(name, handler);
        video.pause(); video.removeAttribute('src'); video.load();
        if (error) reject(error); else resolve();
      };
      const abort = () => { if (started && allowed() && signal.reason === 'dismissed') tracker.close(); finish(new Error('Video cancelled')); };
      let waiting = setTimeout(() => finish(new Error('Video timed out')), 10000);
      const events = {
        playing: () => { clearTimeout(waiting); if (!active()) { abort(); return; }
          if (!started) { started = true; tracker.trackImpression(); tracker.track('start', { once: true }); } },
        timeupdate: () => { if (active() && started && !video.seeking) tracker.setProgress(Math.min(video.currentTime, creative.duration)); },
        ended: () => { if (active() && started) tracker.complete(); finish(); },
        seeking: () => { if (started && active()) tracker.close(); finish(new Error('Video interrupted')); },
        waiting: () => { clearTimeout(waiting); waiting = setTimeout(() => finish(new Error('Video stalled')), 10000); },
        error: () => finish(new Error('Video unavailable')),
        pause: () => { if (active() && started) tracker.setPaused(true); },
        play: () => { if (active() && started) tracker.setPaused(false); },
        volumechange: () => { if (active()) tracker.setMuted(video.muted); },
      };
      for (const [name, handler] of Object.entries(events)) video.addEventListener(name, handler);
      signal.addEventListener('abort', abort, { once: true });
      video.muted = true; video.src = videoUrl(media.fileURL); video.play().catch(() => finish(new Error('Video playback blocked')));
    });
    return;
  }
  throw new Error('No playable video');
}
