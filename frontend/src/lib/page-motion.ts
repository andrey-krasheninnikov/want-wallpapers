import { initBackgroundMotion } from '@want-foundation/desyst-foundation';

export function initPageMotion() {
  const control = document.querySelector<HTMLButtonElement>('[data-background-toggle]');
  const background = document.querySelector<HTMLElement>('.page-background');
  if (!document.documentElement.hasAttribute('data-public-background') || !control || !background) return () => {};
  return initBackgroundMotion({ background, control });
}
