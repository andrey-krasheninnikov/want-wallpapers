export function carouselScroll(element: HTMLElement) {
  const sign = getComputedStyle(element).direction === 'rtl' ? -1 : 1;
  const max = Math.max(0, element.scrollWidth - element.clientWidth);
  return { sign, max, offset: Math.max(0, Math.min(max, element.scrollLeft * sign)) };
}

export function scrollCarousel(element: HTMLElement, offset: number) {
  const { sign, max } = carouselScroll(element);
  element.scrollTo({ left: Math.max(0, Math.min(max, offset)) * sign,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
