/**
 * Motion preference. Honors `prefers-reduced-motion`, and lets authors force either mode for a
 * subtree with `data-tr-motion="reduce"` or `data-tr-motion="full"` on any ancestor (useful for
 * kiosks, tests and settings panels).
 *
 * Reduced motion keeps every state change visible but removes the travel: presses and toggles
 * still change depth and light, springs become critically damped and short, inertia is off and
 * programmatic glides jump straight to the value. Sound and haptics are unaffected; they are not
 * motion.
 */

let media: MediaQueryList | null = null;

function systemReduced(): boolean {
  if (typeof matchMedia === 'undefined') return false;
  media ??= matchMedia('(prefers-reduced-motion: reduce)');
  return media.matches;
}

/** True when motion should be reduced for this element. */
export function reducedMotion(el?: Element | null): boolean {
  let node: Node | null | undefined = el;
  // Walk up through shadow roots, so the attribute works around any component.
  while (node) {
    if (node instanceof Element) {
      const v = node.getAttribute('data-tr-motion');
      if (v === 'reduce') return true;
      if (v === 'full') return false;
    }
    node = node.parentNode ?? (node instanceof ShadowRoot ? node.host : null);
  }
  return systemReduced();
}
