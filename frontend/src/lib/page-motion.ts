import { initBackgroundMotion } from '@want-foundation/desyst-foundation';

export function initPageMotion() {
  const control = document.querySelector<HTMLButtonElement>('[data-background-toggle]');
  const background = document.querySelector<HTMLElement>('.page-background');
  if (!document.documentElement.hasAttribute('data-public-background') || !control || !background) return () => {};
  const dispose = initBackgroundMotion({ background, control, shimmerDelayMs: [5000, 10000] });
  let press: { x: number; y: number; id: number } | undefined;
  const down = (event: PointerEvent) => {
    press = event.pointerType === 'mouse' && event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : undefined;
  };
  const up = (event: PointerEvent) => {
    const start = press; press = undefined;
    if (!start || start.id !== event.pointerId || event.button !== 0 || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
    const target = event.target;
    if (!(target instanceof Element) || document.documentElement.dataset.backgroundMotion !== 'running' || !window.getSelection()?.isCollapsed) return;
    if (document.querySelector('[role="dialog"], dialog[open]') || target.closest('a,button,input,select,textarea,label,summary,[contenteditable],[role="button"],[role="link"],[inert],p,h1,h2,h3,h4,h5,h6,li,dt,dd,pre,code,blockquote,[data-long-copy]')) return;
    for (let element: Element | null = target; element && element !== document.body; element = element.parentElement) {
      const style = getComputedStyle(element);
      if (style.backgroundImage !== 'none' || !/^rgba?\(0, 0, 0, 0\)$/.test(style.backgroundColor)) return;
      if ([...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) return;
    }
    const rect = background.firstElementChild?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    const x = (event.clientX - rect.left - rect.width / 2) / (rect.width * .45);
    const y = (event.clientY - rect.top - rect.height / 2) / (rect.height * .45);
    if (x * x + y * y <= 1) background.dispatchEvent(new Event('want:background-shimmer'));
  };
  const cancel = () => { press = undefined; };
  document.addEventListener('pointerdown', down, { passive: true });
  document.addEventListener('pointerup', up, { passive: true });
  document.addEventListener('pointercancel', cancel);
  window.addEventListener('blur', cancel);
  return () => {
    dispose(); cancel();
    document.removeEventListener('pointerdown', down);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', cancel);
    window.removeEventListener('blur', cancel);
  };
}
