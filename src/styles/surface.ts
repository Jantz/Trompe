import { css, unsafeCSS } from 'lit';
import { hostBundleCss, materialDefaults } from '../generated/tokens.js';

const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='linear' slope='0' intercept='1'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const md = materialDefaults as Record<string, string>;

/**
 * Host-level setup shared by every Trompe component:
 * - resolves the light vector, realism and the active material (with plastic fallbacks)
 * - maps the depth attribute to a signed distance in --_depth
 * - applies :host([material]) and :host([realism]) rules
 */
export const hostStyles = css`
  :host {
    /* Direction shadows are cast: away from the light. 0deg light (top) casts down (+y). */
    --_sx: calc(-1 * sin(var(--tr-light-angle, 330deg)));
    --_sy: cos(var(--tr-light-angle, 330deg));
    /* Shadow length factor from light elevation: lower light, longer shadows. */
    --_len: clamp(0.3, calc(1 / tan(var(--tr-light-elevation, 55deg))), 3);
    --_r: min(var(--tr-realism, 0.65) * var(--tr-realism-scale, 1), var(--tr-realism-max, 1));

    /* Material, then finish (wins over material), then profile. Plastic fallbacks. */
    --_m-base: var(--tr-m-base, ${unsafeCSS(md.base)});
    --_m-ink: var(--tr-m-ink, ${unsafeCSS(md.ink)});
    --_specular: var(--tr-f-specular, var(--tr-m-specular, ${unsafeCSS(md.specular)}));
    --_roughness: var(--tr-f-roughness, var(--tr-m-roughness, ${unsafeCSS(md.roughness)}));
    --_metal: var(--tr-m-metalness, ${unsafeCSS(md.metalness)});
    --_brush: var(--tr-f-brush, var(--tr-m-brush, ${unsafeCSS(md.brush)}));
    --_spin: var(--tr-f-spin, var(--tr-m-spin, ${unsafeCSS(md.spin)}));
    --_gloss: var(--tr-f-gloss, var(--tr-m-gloss, ${unsafeCSS(md.gloss)}));
    --_mirror: var(--tr-f-mirror, var(--tr-m-mirror, ${unsafeCSS(md.mirror)}));
    --_grain: var(--tr-m-grain, ${unsafeCSS(md.grain)});
    --_trans: var(--tr-m-translucency, ${unsafeCSS(md.translucency)});
    --_bevel: var(--tr-m-bevel, ${unsafeCSS(md.bevel)});
    /* components set --_curve-default / --_chamfer-default for their natural shape */
    --_curve: var(--tr-p-curve, var(--_curve-default, 0));
    --_chamfer: var(--tr-p-chamfer, var(--_chamfer-default, 0px));

    /* private reflection damping set by large surfaces (panels, dialogs); never leaks into children */
    --_reflect: initial;
    box-sizing: border-box;
    font-family: var(--tr-font-family);
    -webkit-tap-highlight-color: transparent;
  }
  :host([hidden]) {
    display: none !important;
  }
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }
  :host([depth='-2']) { --_depth: -2; }
  :host([depth='-1']) { --_depth: -1; }
  :host([depth='0']) { --_depth: 0; }
  :host([depth='1']) { --_depth: 1; }
  :host([depth='2']) { --_depth: 2; }
  :host([depth='3']) { --_depth: 3; }
  :host([depth='4']) { --_depth: 4; }
  ${unsafeCSS(hostBundleCss)}

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      transition-duration: 0s !important;
      animation-duration: 0s !important;
    }
  }
`;

/**
 * The physical surface. Put class="surface" on an element and set:
 *   --_tr-z     signed depth level (number, -2..4). Registered, so it animates.
 *   --_base     base color (defaults to the material base)
 *   --_ink      text color (defaults to the material ink)
 *   --_edge     border color (defaults to --tr-color-edge, which meets 3:1)
 *   --_reflect  0..1 damping of gloss, mirror and brushed bands for large surfaces (private, reset on every host);
 *               --tr-reflect-scale is the public, inherited equivalent. Legacy line: damping of gloss and mirror reflections (public: large text-bearing surfaces use < 1)
 */
export const surfaceStyles = css`
  .surface {
    --_base: var(--_m-base);
    --_ink: var(--_m-ink);
    /* softens as realism rises (shadows and rims take over); --_edge-strong stays at 3:1 */
    --_edge-strong: var(--tr-color-edge);
    --_edge: color-mix(in oklch, var(--tr-color-edge) calc(100% - var(--_r) * 55%), transparent);
    --_hl: var(--tr-color-highlight, #fff);
    --_sh: var(--tr-color-shadow, #000);
    --_raise: max(0, var(--_tr-z));
    --_sink: max(0, -1 * var(--_tr-z));
    /* non-linear physical offset: each level reads clearly higher than the last */
    --_off: calc(pow(var(--_raise), var(--tr-depth-curve, 1.6)) * var(--tr-depth-unit, 2px) * var(--_len));
    --_in: calc(pow(var(--_sink), var(--tr-depth-curve, 1.6)) * var(--tr-depth-unit, 2px) * var(--_len) * 1.2);
    /* highlight strength: sharp highlights read brighter */
    --_spec: calc(var(--_specular) * (1 - var(--_roughness) * 0.6) * var(--_r));
    /* reflections fade in faster than shadows as realism rises */
    --_rg: calc(var(--_r) * (2 - var(--_r)));
    /* metals shade with more contrast */
    --_contrast: calc(1 + var(--_metal) * 0.6);
    --_convex: max(0, var(--_curve));
    --_concave: max(0, -1 * var(--_curve));
    /* where the light hits the face, as a position inside the box */
    --_lx: calc(50% - var(--_sx) * 34%);
    --_ly: calc(50% - var(--_sy) * 34%);
    /* in dark themes raised faces get lighter, since shadows barely show */
    --_face: color-mix(in oklch, var(--_hl) calc(var(--_raise) * var(--tr-lift, 0) * 3.5%), var(--_base));

    position: relative;
    isolation: isolate;
    color: var(--_ink);
    /* engraved/embossed ink: keeps labels legible over glossy and mirror reflections */
    text-shadow: 0 calc(var(--_sy) * 1px) calc(var(--_r) * 1px)
      oklch(from var(--_ink) calc(1 - round(l)) 0 0 / calc(var(--_r) * (0.25 + (var(--_gloss) + var(--_mirror)) * 0.35)));
    border: 1px solid var(--_edge);
    background-color: var(--_face);
    background-image:
      /* hook for component-specific layers */
      var(--_layer, none),
      /* clear-coat window reflection toward the light: crisp-edged, like a softbox in lacquer */
      radial-gradient(
        ellipse 82% 50% at calc(50% - var(--_sx) * 14%) calc(50% - var(--_sy) * 30%),
        color-mix(in oklch, var(--_hl) calc(var(--_gloss) * var(--_rg) * var(--_reflect, var(--tr-reflect-scale, 1)) * 85%), transparent) 0%,
        color-mix(in oklch, var(--_hl) calc(var(--_gloss) * var(--_rg) * var(--_reflect, var(--tr-reflect-scale, 1)) * 32%), transparent) 92%,
        transparent 100%
      ),
      /* clear-coat caustic: light passing through and glowing on the far side */
      radial-gradient(
        ellipse 70% 38% at calc(50% + var(--_sx) * 30%) calc(50% + var(--_sy) * 42%),
        color-mix(in oklch, var(--_hl) calc(var(--_gloss) * var(--_rg) * var(--_reflect, var(--tr-reflect-scale, 1)) * 38%), transparent) 0%,
        transparent 100%
      ),
      /* mirror: sky, dark horizon, ground bounce. The environment stays upright; the light only tilts it a little. */
      linear-gradient(
        calc(var(--tr-light-environment, 180deg) + (var(--tr-light-angle, 330deg) - 360deg) * 0.15),
        color-mix(in oklch, var(--_hl) calc(var(--_mirror) * var(--_rg) * var(--_reflect, var(--tr-reflect-scale, 1)) * 90%), transparent) 0%,
        color-mix(in oklch, var(--_hl) calc(var(--_mirror) * var(--_rg) * var(--_reflect, var(--tr-reflect-scale, 1)) * 45%), transparent) 46%,
        color-mix(in oklch, var(--_sh) calc(var(--_mirror) * var(--_rg) * var(--_reflect, var(--tr-reflect-scale, 1)) * 55%), transparent) 64%,
        color-mix(in oklch, var(--_sh) calc(var(--_mirror) * var(--_rg) * var(--_reflect, var(--tr-reflect-scale, 1)) * 25%), transparent) 72%,
        color-mix(in oklch, var(--_hl) calc(var(--_mirror) * var(--_rg) * var(--_reflect, var(--tr-reflect-scale, 1)) * 18%), transparent) 84%,
        color-mix(in oklch, var(--_hl) calc(var(--_mirror) * var(--_rg) * var(--_reflect, var(--tr-reflect-scale, 1)) * 70%), transparent) 100%
      ),
      /* spun metal: concentric anisotropic reflections */
      conic-gradient(
        from var(--tr-light-angle, 330deg),
        color-mix(in oklch, var(--_hl) calc(var(--_spin) * var(--_r) * 55%), transparent),
        color-mix(in oklch, var(--_sh) calc(var(--_spin) * var(--_r) * 25%), transparent) 25%,
        color-mix(in oklch, var(--_hl) calc(var(--_spin) * var(--_r) * 45%), transparent) 50%,
        color-mix(in oklch, var(--_sh) calc(var(--_spin) * var(--_r) * 25%), transparent) 75%,
        color-mix(in oklch, var(--_hl) calc(var(--_spin) * var(--_r) * 55%), transparent)
      ),
      repeating-radial-gradient(
        circle at 50% 50%,
        color-mix(in oklch, var(--_hl) calc(var(--_spin) * var(--_r) * 14%), transparent) 0 1px,
        transparent 1px 2px,
        color-mix(in oklch, var(--_sh) calc(var(--_spin) * var(--_r) * 6%), transparent) 2px 3px
      ),
      /* convex: lit where the bulge faces the light, shaded on the far side */
      radial-gradient(
        farthest-corner at var(--_lx) var(--_ly),
        color-mix(in oklch, var(--_hl) calc(var(--_convex) * var(--_r) * 48%), transparent) 0%,
        transparent 50%,
        color-mix(in oklch, var(--_sh) calc(var(--_convex) * var(--_r) * var(--_contrast) * 26%), transparent) 100%
      ),
      /* concave: the wall nearest the light is in shade, the far wall is lit */
      radial-gradient(
        farthest-corner at calc(100% - var(--_lx)) calc(100% - var(--_ly)),
        color-mix(in oklch, var(--_hl) calc(var(--_concave) * var(--_r) * 34%), transparent) 0%,
        transparent 50%,
        color-mix(in oklch, var(--_sh) calc(var(--_concave) * var(--_r) * 24%), transparent) 100%
      ),
      /* broad light falloff across the face */
      linear-gradient(
        calc(var(--tr-light-angle, 330deg) + 180deg),
        color-mix(in oklch, var(--_hl) calc(var(--_spec) * 60%), transparent) 0%,
        transparent calc(18% + var(--_roughness) * 40%),
        transparent calc(55% + var(--_roughness) * 15%),
        color-mix(in oklch, var(--_sh) calc(var(--_r) * var(--_contrast) * 14%), transparent) 100%
      ),
      /* brushed: anisotropic specular bands */
      linear-gradient(
        calc(var(--tr-light-angle, 330deg) + 180deg),
        transparent 20%,
        color-mix(in oklch, var(--_hl) calc(var(--_r) * var(--_brush) * var(--_reflect, var(--tr-reflect-scale, 1)) * 45%), transparent) 33%,
        transparent 45%,
        transparent 62%,
        color-mix(in oklch, var(--_hl) calc(var(--_r) * var(--_brush) * var(--_reflect, var(--tr-reflect-scale, 1)) * 26%), transparent) 71%,
        transparent 80%
      ),
      /* brushed: two hairline periods so the grain never looks regular */
      repeating-linear-gradient(
        0deg,
        color-mix(in oklch, var(--_hl) calc(var(--_r) * var(--_brush) * (0.06 + 0.1 * var(--_reflect, var(--tr-reflect-scale, 1))) * 100%), transparent) 0 1px,
        transparent 1px 3px
      ),
      repeating-linear-gradient(
        0deg,
        color-mix(in oklch, var(--_sh) calc(var(--_r) * var(--_brush) * 8%), transparent) 0 1px,
        transparent 1px 5px,
        color-mix(in oklch, var(--_sh) calc(var(--_r) * var(--_brush) * 5%), transparent) 5px 6px,
        transparent 6px 11px
      );
    box-shadow:
      /* specular rim on the lit edge */
      inset calc(var(--_sx) * var(--_bevel)) calc(var(--_sy) * var(--_bevel)) 0 0
        color-mix(in oklch, var(--_hl) calc((var(--_spec) * 0.9 + var(--_r) * 0.25) * min(1, var(--_raise) + 0.4) * 100%), transparent),
      /* shadowed rim on the far edge */
      inset calc(var(--_sx) * -1 * var(--_bevel)) calc(var(--_sy) * -1 * var(--_bevel)) 0 0
        color-mix(in oklch, var(--_sh) calc(var(--_r) * var(--_contrast) * 18%), transparent),
      /* chamfer: a wide machined edge band, lit toward the light and dark away from it */
      inset calc(var(--_sx) * var(--_chamfer)) calc(var(--_sy) * var(--_chamfer)) calc(var(--_chamfer) * 0.6) 0
        color-mix(in oklch, var(--_hl) calc(var(--_r) * 75%), transparent),
      inset calc(var(--_sx) * -1 * var(--_chamfer)) calc(var(--_sy) * -1 * var(--_chamfer)) calc(var(--_chamfer) * 0.6) 0
        color-mix(in oklch, var(--_sh) calc(var(--_r) * var(--_contrast) * 38%), transparent),
      /* recess: inner shadow under the lit rim */
      inset calc(var(--_sx) * var(--_in)) calc(var(--_sy) * var(--_in)) calc(var(--_in) * 1.6) 0
        color-mix(in oklch, var(--_sh) calc(var(--_r) * 50%), transparent),
      /* recess: far lip catching the light */
      calc(var(--_sx) * min(1, var(--_sink)) * 1px) calc(var(--_sy) * min(1, var(--_sink)) * 1px) 0 0
        color-mix(in oklch, var(--_hl) calc(var(--_r) * 60%), transparent),
      /* contact shadow (tight) */
      calc(var(--_sx) * var(--_off) * 0.25) calc(var(--_sy) * var(--_off) * 0.25) calc(var(--_off) * 0.5) 0
        color-mix(in oklch, var(--_sh) calc(var(--_r) * min(1, var(--_raise)) * 34%), transparent),
      /* key shadow (directional) */
      calc(var(--_sx) * var(--_off)) calc(var(--_sy) * var(--_off)) calc(var(--_off) * 2) 0
        color-mix(in oklch, var(--_sh) calc(var(--_r) * (min(1, var(--_raise)) * 20% + var(--_raise) * 2.5%)), transparent),
      /* ambient (soft, undirected) */
      0 calc(var(--_off) * 0.5) calc(var(--_off) * 4) 0
        color-mix(in oklch, var(--_sh) calc(var(--_r) * var(--_raise) * 4%), transparent);
  }
  /* Only translucent materials pay for a backdrop blur. */
  :host([material='glass']) .surface:not(.surface .surface) {
    backdrop-filter: blur(calc(var(--_trans) * (6px + var(--_r) * 10px))) saturate(calc(1 + var(--_trans) * 0.4));
  }
  /* Only the outermost surface of a component blurs; nested parts would show as boxes. */
  @container style(--tr-m-translucency: 1) {
    .surface:not(.surface .surface) {
      backdrop-filter: blur(calc(6px + var(--_r) * 10px)) saturate(1.4);
    }
  }
  /* grain: a separate layer so it never sits under text at full strength */
  .surface::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    pointer-events: none;
    background-image: ${unsafeCSS(NOISE)};
    background-size: 180px 180px;
    mix-blend-mode: overlay;
    opacity: calc(var(--_grain) * var(--_r) * var(--_r) * 2.5);
  }
  @media (prefers-reduced-transparency: reduce) {
    .surface {
      background-color: oklch(from var(--_face) l c h / 1);
      backdrop-filter: none !important;
    }
  }
  @media (forced-colors: active) {
    .surface {
      border-color: CanvasText;
      background-image: none;
    }
    .surface::before {
      display: none;
    }
  }
`;

/** Focus ring shared by all focusable controls. */
export const focusStyles = css`
  :host(:focus) {
    outline: none;
  }
  :host(:focus-visible) .focus-ring {
    outline: 2px solid var(--tr-color-focus);
    outline-offset: 3px;
  }
  @media (forced-colors: active) {
    :host(:focus-visible) .focus-ring {
      outline-color: Highlight;
    }
  }
`;
