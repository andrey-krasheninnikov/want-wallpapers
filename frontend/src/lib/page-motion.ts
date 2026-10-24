export function initPageMotion() {
  const root = document.documentElement;
  const control = document.querySelector<HTMLButtonElement>('[data-background-toggle]');
  const background = document.querySelector<HTMLElement>('.page-background');
  const sphere = background?.firstElementChild;
  if (!root.hasAttribute('data-public-background') || !control || !background || !sphere) return () => {};

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const forced = window.matchMedia('(forced-colors: active)');
  let paused = false, disposed = false, height = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { paused = localStorage.getItem('want-background-motion') === 'paused'; } catch {}
  const stop = () => { clearTimeout(timer); timer = undefined; };
  const schedule = () => {
    stop();
    if (!disposed && root.dataset.backgroundMotion === 'running' && !background.hasAttribute('data-background-shimmer')) {
      timer = setTimeout(() => {
        timer = undefined;
        if (!disposed && root.dataset.backgroundMotion === 'running') background.dataset.backgroundShimmer = '';
      }, 8000 + Math.random() * 10000);
    }
  };
  const resize = () => {
    if (disposed || height === background.clientHeight) return;
    height = background.clientHeight;
    const animation = sphere.getAnimations().find(item => (item as CSSAnimation).animationName === 'want-gradient-sphere');
    const duration = animation?.effect?.getComputedTiming().duration;
    const progress = animation && typeof animation.currentTime === 'number' && typeof duration === 'number' && duration > 0
      ? animation.currentTime / duration : null;
    const seconds = Math.max(28, height / 30);
    background.style.setProperty('--background-center-y', `${height / 2}px`);
    background.style.setProperty('--background-travel-y', `${height * .45}px`);
    background.style.setProperty('--background-duration', `${seconds}s`);
    sphere.getAnimations();
    if (animation && progress !== null) animation.currentTime = progress * seconds * 1000;
  };
  const observer = new ResizeObserver(resize);
  const update = () => {
    if (disposed) return;
    const allowed = !reduced.matches && !forced.matches;
    root.dataset.backgroundMotion = allowed && !paused && !document.hidden ? 'running' : 'paused';
    control.hidden = !allowed;
    control.textContent = paused ? control.dataset.playLabel! : control.dataset.pauseLabel!;
    if (!allowed) background.removeAttribute('data-background-shimmer');
    schedule();
  };
  const finish = (event: AnimationEvent) => {
    if (event.animationName !== 'want-gradient-shimmer') return;
    background.removeAttribute('data-background-shimmer');
    schedule();
  };
  const toggle = () => {
    paused = !paused;
    try { localStorage.setItem('want-background-motion', paused ? 'paused' : 'running'); } catch {}
    update();
  };
  control.addEventListener('click', toggle);
  background.addEventListener('animationend', finish);
  document.addEventListener('visibilitychange', update);
  reduced.addEventListener('change', update);
  forced.addEventListener('change', update);
  resize();
  observer.observe(background);
  update();
  return () => {
    if (disposed) return;
    disposed = true;
    stop();
    observer.disconnect();
    control.removeEventListener('click', toggle);
    background.removeEventListener('animationend', finish);
    document.removeEventListener('visibilitychange', update);
    reduced.removeEventListener('change', update);
    forced.removeEventListener('change', update);
  };
}
