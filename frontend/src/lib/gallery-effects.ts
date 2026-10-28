import { burstConfetti, initInteractionEffects } from '@want-foundation/desyst-foundation';

export function initGalleryEffects() {
  const disposeInteractions = initInteractionEffects();
  let disposeConfetti = () => {};
  const download = () => {
    const button = document.getElementById('download-link');
    if (!button) return;
    disposeConfetti();
    disposeConfetti = burstConfetti(button);
  };
  window.addEventListener('want:download', download);
  return () => {
    window.removeEventListener('want:download', download);
    disposeInteractions();
    disposeConfetti();
  };
}
