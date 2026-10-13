export function initPageMotion() {
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
