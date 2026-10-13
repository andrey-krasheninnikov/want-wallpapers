export function initGalleryEffects() {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const colors = matchMedia('(forced-colors: active)');
  let active: HTMLElement | null = null;
  let frame = 0;
  let lastSpark = 0;
  let sparks = 0;
  let burst = false;
  const reset = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    for (const property of ['--tilt-x', '--tilt-y', '--shift-x', '--shift-y', '--image-scale']) active?.style.removeProperty(property);
    active = null;
  };
  document.addEventListener('pointermove', (event) => {
    if (motion.matches || !pointer.matches || colors.matches || event.buttons) { reset(); return; }
    const target = event.target instanceof Element ? event.target : null;
    const card = target?.closest<HTMLElement>('.gallery-card') ?? null;
    if (active !== card) { reset(); active = card; }
    if (card) {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
        const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
        card.style.setProperty('--tilt-x', `${-y * 1.5}deg`); card.style.setProperty('--tilt-y', `${x * 1.5}deg`);
        card.style.setProperty('--shift-x', `${x * 3}px`); card.style.setProperty('--shift-y', `${y * 3}px`);
        card.style.setProperty('--image-scale', '1.015'); frame = 0;
      });
    }
    if (!target?.closest('[data-long-copy]') || window.getSelection()?.toString() || sparks >= 6 || performance.now() - lastSpark < 90) return;
    lastSpark = performance.now(); sparks++;
    const spark = document.createElement('span'); spark.className = 'wand-spark'; spark.setAttribute('aria-hidden', 'true');
    spark.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20 15 9m-1-3 4 4M18 2v4m-2-2h4M6 5v4M4 7h4"/></svg>';
    spark.style.left = `${event.clientX + 12}px`; spark.style.top = `${event.clientY - 24}px`;
    document.body.append(spark);
    const animation = spark.animate([{ opacity: .8, transform: 'translateY(0) scale(.8)' }, { opacity: 0, transform: 'translateY(-8px) scale(1)' }], { duration: 350 });
    void animation.finished.catch(() => {}).finally(() => { spark.remove(); sparks--; });
  }, { passive: true });
  document.addEventListener('pointerout', (event) => { if (!event.relatedTarget) reset(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  motion.addEventListener('change', reset);
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
