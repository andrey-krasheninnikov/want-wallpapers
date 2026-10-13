export function initPageMotion() {
  const root = document.documentElement;
  const control = document.querySelector<HTMLButtonElement>('[data-background-toggle]');
  if (root.hasAttribute('data-pixel-background') && control) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const forced = window.matchMedia('(forced-colors: active)');
    let paused = false;
    try { paused = localStorage.getItem('want-background-motion') === 'paused'; } catch {}
    const update = () => {
      const allowed = !reduced.matches && !forced.matches;
      root.dataset.backgroundMotion = allowed && !paused && !document.hidden ? 'running' : 'paused';
      control.hidden = !allowed;
      control.textContent = paused ? control.dataset.playLabel! : control.dataset.pauseLabel!;
    };
    control.addEventListener('click', () => {
      paused = !paused;
      try { localStorage.setItem('want-background-motion', paused ? 'paused' : 'running'); } catch {}
      update();
    });
    document.addEventListener('visibilitychange', update);
    reduced.addEventListener('change', update);
    forced.addEventListener('change', update);
    update();
  }
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      (entry.target as HTMLElement).dataset.revealed = '';
      observer.unobserve(entry.target);
    }
  }, { threshold: .1 });
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((element) => {
    element.dataset.revealPending = '';
    observer.observe(element);
  });
  document.documentElement.dataset.motionReady = '';
}
