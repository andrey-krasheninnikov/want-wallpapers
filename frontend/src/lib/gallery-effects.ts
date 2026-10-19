export function initGalleryEffects() {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const colors = matchMedia('(forced-colors: active)');
  let lastSpark = 0;
  let sparks = 0;
  let burst = false;
  document.addEventListener('pointermove', (event) => {
    if (motion.matches || !pointer.matches || colors.matches || event.buttons) return;
    const target = event.target instanceof Element ? event.target : null;
    const text = target?.closest('p, h1, h2, h3, h4, h5, h6, a, button, label, summary, span, strong, small, li, dt, dd, time, output, figcaption');
    if (!text?.textContent?.trim() || target?.closest('input, textarea, [contenteditable], img, svg, model-viewer') || window.getSelection()?.toString() || sparks >= 8 || performance.now() - lastSpark < 55) return;
    lastSpark = performance.now(); sparks++;
    const spark = document.createElement('span'); spark.className = 'wand-spark'; spark.setAttribute('aria-hidden', 'true');
    spark.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20 15 9m-1-3 4 4M18 2v4m-2-2h4M6 5v4M4 7h4"/></svg>';
    spark.style.left = `${event.clientX + 18}px`; spark.style.top = `${event.clientY - 32}px`;
    document.body.append(spark);
    const animation = spark.animate([{ opacity: .95, transform: 'translateY(0) rotate(-8deg) scale(.9)' }, { opacity: 1, transform: 'translateY(-7px) rotate(4deg) scale(1.15)', offset: .3 }, { opacity: 0, transform: 'translateY(-20px) rotate(12deg) scale(1.25)' }], { duration: 650 });
    void animation.finished.catch(() => {}).finally(() => { spark.remove(); sparks--; });
  }, { passive: true });
  window.addEventListener('want:download', () => {
    if (motion.matches || !pointer.matches || colors.matches || burst) return;
    const button = document.getElementById('download-link'); if (!button) return;
    const rect = button.getBoundingClientRect(); burst = true;
    const particles: HTMLElement[] = [];
    for (let index = 0; index < 18; index++) {
      const particle = document.createElement('span'); particle.className = 'download-confetti'; particle.setAttribute('aria-hidden', 'true');
      particle.style.left = `${rect.left + rect.width / 2}px`; particle.style.top = `${rect.top + rect.height / 2}px`;
      if (index % 3 === 0) particle.style.background = 'var(--foreground)';
      document.body.append(particle); particles.push(particle);
      const angle = index * Math.PI * 2 / 18, distance = 45 + Math.random() * 45;
      const animation = particle.animate([{ transform: 'translate(0, 0) rotate(0)', opacity: 1 }, { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance + 28}px) rotate(${index * 35}deg)`, opacity: 0 }], { duration: 800, easing: 'cubic-bezier(.2,.7,.3,1)' });
      void animation.finished.catch(() => {}).finally(() => particle.remove());
    }
    window.setTimeout(() => { particles.forEach((particle) => particle.remove()); burst = false; }, 850);
  });
}
