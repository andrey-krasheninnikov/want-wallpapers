export function initPageMotion() {
  let cleanup = () => {};
  const root = document.documentElement;
  const control = document.querySelector<HTMLButtonElement>('[data-background-toggle]');
  if (root.hasAttribute('data-public-background') && control) {
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
    const toggle = () => {
      paused = !paused;
      try { localStorage.setItem('want-background-motion', paused ? 'paused' : 'running'); } catch {}
      update();
    };
    control.addEventListener('click', toggle);
    document.addEventListener('visibilitychange', update);
    reduced.addEventListener('change', update);
    forced.addEventListener('change', update);
    update();
    cleanup = () => { control.removeEventListener('click', toggle); document.removeEventListener('visibilitychange', update); reduced.removeEventListener('change', update); forced.removeEventListener('change', update); };
  }
  return cleanup;
}
