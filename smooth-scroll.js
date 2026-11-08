import Lenis from './assets/vendor/lenis/lenis.mjs';

// Driven by the existing WebGL RAF, so DOM and 3D share a single scroll position.
export function createSmoothScroll(canScroll = () => true) {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let lenis;
  function configure() {
    lenis?.destroy();
    lenis = preference.matches ? null : new Lenis({
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: false,
      prevent: node => !canScroll() || !!node.closest?.('dialog, [data-lenis-prevent]'),
    });
  }
  configure();
  preference.addEventListener('change', configure);
  return {
    raf(time) { lenis?.raf(time); },
    scrollTo(target, options = {}) {
      if (lenis) { lenis.resize(); lenis.scrollTo(target, options); }
      else window.scrollTo({ top: target, behavior: 'instant' });
    },
    reset() {
      if (lenis) { lenis.resize(); lenis.scrollTo(0, { immediate: true, force: true }); }
      else window.scrollTo({ top: 0, behavior: 'instant' });
    },
    destroy() { preference.removeEventListener('change', configure); lenis?.destroy(); lenis = null; },
  };
}
