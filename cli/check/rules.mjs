// Rule catalogue. Ids are stable; names are what agents read. Each rule has a docs anchor.
export const RULES = {
  TR001: { name: 'unknown-element', severity: 'error', summary: 'A tr-* element that Trompe does not define.' },
  TR002: { name: 'unknown-attribute', severity: 'error', summary: 'An attribute the element does not declare (global HTML, aria-*, data-* and framework bindings are allowed).' },
  TR003: { name: 'invalid-value', severity: 'error', summary: 'An attribute value outside the declared enum or type.' },
  TR004: { name: 'boolean-false', severity: 'warning', summary: 'A boolean attribute written as ="false" is still true. Remove the attribute instead.' },
  TR005: { name: 'accessible-name', severity: 'error', summary: 'An interactive element with no accessible name (text, label, aria-label or aria-labelledby).' },
  TR006: { name: 'unknown-skin', severity: 'error', summary: 'data-tr-skin names a skin that does not exist.' },
  TR007: { name: 'hand-shadow', severity: 'warning', summary: 'Hand-written shadow, filter or gradient on a Trompe element bypasses the light model. Use depth, material, finish or a skin.' },
  TR008: { name: 'unknown-token', severity: 'error', summary: 'var(--tr-…) refers to a token or variable Trompe does not define.' },
  TR009: { name: 'private-variable', severity: 'error', summary: 'Setting a private --_ variable. These are internal and change without notice.' },
  TR010: { name: 'light-override', severity: 'warning', summary: 'The light is set on an inner element. One light per scene: set it on :root, <body> or a container with data-tr-skin or data-tr-scene.' },
  TR011: { name: 'glass-on-glass', severity: 'warning', summary: 'Glass inside glass blurs twice, costs GPU time and usually fails text contrast.' },
  TR012: { name: 'depth-budget', severity: 'warning', summary: 'More than three distinct raised depths in one view flattens the hierarchy.' },
  TR013: { name: 'realism-mix', severity: 'warning', summary: 'More than two realism levels in one view looks inconsistent.' },
  TR014: { name: 'nested-interactive', severity: 'error', summary: 'An interactive element inside another interactive element breaks keyboard and screen reader behaviour.' },
  TR015: { name: 'skin-stylesheet', severity: 'warning', summary: 'data-tr-skin is used but the page never loads skins.css (or skins/<name>.css).' },
  TR016: { name: 'unknown-part', severity: 'error', summary: '::part() names a part the element does not expose.' },
  TR017: { name: 'unknown-variable', severity: 'warning', summary: 'A --tr-* custom property is set that no Trompe element or token reads.' },

  TR101: { name: 'text-contrast', severity: 'error', summary: 'Rendered text below WCAG contrast (from axe-core).' },
  TR102: { name: 'axe', severity: 'error', summary: 'Other axe-core accessibility violations.' },
  TR103: { name: 'target-size', severity: 'error', summary: 'Interactive element smaller than 24×24 CSS px (WCAG 2.5.8).' },
  TR104: { name: 'forced-colors-edge', severity: 'error', summary: 'Under forced colours the control has no visible boundary.' },
  TR105: { name: 'paint-budget', severity: 'warning', summary: 'Too many backdrop-filter surfaces or shadow layers for smooth rendering.' },
  TR106: { name: 'runtime-error', severity: 'error', summary: 'The page threw an error or a Trompe element failed to upgrade.' },

  TR201: { name: 'skin-schema', severity: 'error', summary: 'The skin file does not match the skin format.' },
  TR202: { name: 'skin-unknown-token', severity: 'error', summary: 'The skin sets a token, element, variable or bundle value Trompe does not have.' },
  TR203: { name: 'skin-contrast', severity: 'error', summary: 'A colour pair in the skin fails WCAG contrast.' },
};

export const DOCS = 'https://github.com/Jantz/Trompe/blob/main/docs/check.md';

export function finding(id, props) {
  const r = RULES[id];
  return { id, rule: r.name, ...props, severity: props.severity ?? r.severity, docs: `${DOCS}#${id.toLowerCase()}-${r.name}` };
}
