export function initCollectionCovers() {
  const cleanup: (() => void)[] = [];
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const data = matchMedia('(prefers-reduced-data: reduce)');
  const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
  for (const root of document.querySelectorAll('[data-collection-cover]')) {
    const video = root.querySelector<HTMLVideoElement>('[data-cover-video]');
    const button = root.querySelector<HTMLButtonElement>('[data-cover-control]');
    if (!video || !button || !video.canPlayType('video/mp4') || typeof IntersectionObserver === 'undefined') continue;
    let visible = false, paused = true, failed = false, attempt = 0;
    const allowed = () => !motion.matches && !data.matches && !connection?.saveData && !failed;
    function poster() { video!.pause(); video!.hidden = true; }
    function label(playing: boolean) {
      button!.setAttribute('aria-label', (playing ? button!.dataset.pauseLabel : button!.dataset.playLabel)!);
      button!.dataset.playing = String(playing);
    }
    async function update() {
      const current = ++attempt;
      button!.hidden = !allowed() || !visible;
      if (!allowed() || !visible || document.hidden || paused) {
        paused = true;
        poster(); label(false);
        if (!allowed() && video!.hasAttribute('src')) { video!.removeAttribute('src'); video!.load(); }
        return;
      }
      if (!video!.hasAttribute('src')) video!.src = video!.dataset.src!;
      video!.muted = true;
      try {
        await video!.play();
        if (!allowed() || !visible || document.hidden || paused) { poster(); return; }
        if (current !== attempt) return;
        video!.hidden = false; label(true);
      } catch {
        if (current === attempt) { paused = true; poster(); label(false); }
      }
    }
    button.addEventListener('click', () => { paused = !video.paused; void update(); });
    video.addEventListener('error', () => { failed = true; void update(); });
    const observer = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; void update(); });
    observer.observe(video.parentElement!);
    motion.addEventListener('change', update); data.addEventListener('change', update);
    connection?.addEventListener('change', update); document.addEventListener('visibilitychange', update);
    const hide = () => { ++attempt; poster(); observer.disconnect(); };
    const show = (event: PageTransitionEvent) => { if (event.persisted) observer.observe(video.parentElement!); };
    window.addEventListener('pagehide', hide); window.addEventListener('pageshow', show);
    cleanup.push(() => { hide(); motion.removeEventListener('change', update); data.removeEventListener('change', update); connection?.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show); });
  }
  return () => cleanup.forEach((dispose) => dispose());
}
