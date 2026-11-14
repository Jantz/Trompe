import { css, html, nothing, svg, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import { blankCell, matrixPaths, segmentPaths, toCells, type Cell } from './glyphs.js';

/** Named backlight / phosphor colors. Any other value of `color` is used as a CSS color. */
export const displayColors: Record<string, string> = {
  amber: 'oklch(80% 0.16 70)',
  orange: 'oklch(72% 0.19 50)',
  green: 'oklch(86% 0.16 138)',
  lime: 'oklch(88% 0.17 120)',
  cyan: 'oklch(87% 0.14 182)',
  blue: 'oklch(70% 0.16 250)',
  red: 'oklch(62% 0.25 27)',
  white: 'oklch(96% 0.012 240)',
};

const TYPE_COLOR: Record<string, string> = { lcd: 'lime', vfd: 'cyan', led: 'red', oled: 'white' };

type Glyphs = 'text' | '7seg' | '14seg' | 'matrix';

const reducedMotion = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A screen recessed behind glass: backlit LCD, glowing vacuum-fluorescent (VFD), LED dot matrix
 * or OLED. The screen sits in a bezel of the current material, under a glass cover that catches
 * the scene light, with a shadow cast by the bezel wall onto the glass.
 *
 * Content is either your own rich markup in the default slot (rows, labels, even a
 * `<tr-meter>` that then lights in the display's ink) or the `value` string, which can be drawn
 * as 7-segment, 14-segment (starburst) or 5x8 dot-matrix glyphs with their unlit segments or
 * dots faintly visible, the way real glass shows them. Every glyph is vector, no font files.
 *
 * Annunciators (small labels such as STEREO or KBPS) go in the `top` and `bottom` slots; give one
 * `data-off` to show it unlit.
 *
 * Accessibility: no role by default; the text is read as normal content (glyph renderings carry
 * a visually hidden text copy). Add `live` to announce changes politely. Marquee scrolling stops
 * and truncates with an ellipsis under prefers-reduced-motion.
 *
 * @summary LCD / VFD / LED / OLED display screen behind glass, with segment and matrix glyphs.
 * @tag tr-display
 *
 * @slot - Screen content. Rich markup is fine; it inherits the display ink and glow.
 * @slot top - Annunciator row above the main line. Children with `data-off` show unlit.
 * @slot bottom - Annunciator row below the main line. Children with `data-off` show unlit.
 *
 * @csspart bezel - The frame around the screen (a Trompe surface: follows material).
 * @csspart screen - The emissive screen.
 * @csspart content - Wrapper around the rows.
 * @csspart readout - The line showing `value`.
 * @csspart glass - The glass cover with its reflection.
 *
 * @cssprop --tr-display-color - Backlight (LCD) or phosphor/emitter (VFD, LED, OLED) color.
 * @cssprop --tr-display-ink - Color of lit glyphs. Derived from the color and type.
 * @cssprop --tr-display-ghost - Color of unlit segments and dots. Derived from the ink.
 * @cssprop --tr-display-screen - Screen background. Derived from the color and type.
 * @cssprop --tr-display-glow - Bloom strength, 0 to 2. Default 1 (scaled by realism).
 * @cssprop --tr-display-glare - Glass reflection strength, 0 to 2. Default 1 (scaled by realism).
 * @cssprop --tr-display-font - Font of text content. Default: the monospace stack.
 * @cssprop --tr-display-glyph-size - Height of the `value` line. Default 2em.
 * @cssprop --tr-display-bezel - Bezel width. Default 0.45em.
 * @cssprop --tr-display-radius - Screen corner radius. Default 0.3em.
 * @cssprop --tr-display-padding - Screen padding. Default 0.45em 0.7em.
 * @cssprop --tr-display-ink (exported) - Inside the screen, set to the resolved ink so nested components (tr-meter) can light in it; likewise --tr-display-ghost and --tr-display-bloom.
 *
 * @example <tr-display type="lcd" value="12:45" digits="4"></tr-display>
 * @example <tr-display type="vfd" glyphs="14seg" digits="10" marquee value="NOW PLAYING  AURORA"></tr-display>
 * @example <tr-display type="led" value="ON AIR" color="red"></tr-display>
 * @example <tr-display type="vfd" live><span slot="top">STEREO</span><span slot="top" data-off>MONO</span>128 KBPS</tr-display>
 */
export class TrDisplay extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_depth: 1;
        --_curve-default: 0.15;
        --_bz: var(--tr-display-bezel, 0.45em);
        --_rad: var(--tr-display-radius, 0.3em);
        --_glare: calc(var(--tr-display-glare, 1) * var(--_r));
        display: inline-block;
        vertical-align: middle;
        max-width: 100%;
        line-height: 1.2;
      }
      .bezel {
        --_tr-z: var(--_depth);
        display: block;
        box-sizing: border-box;
        width: 100%;
        padding: var(--_bz);
        border-radius: calc(var(--_rad) + var(--_bz) * 0.8);
        /* resolved screen colors: one set per type, everything else derives from them */
        --_c: var(--_attr-c, var(--tr-display-color));
        --_glow: calc(var(--tr-display-glow, 1) * (0.25 + var(--_r) * 0.85));
      }
      :host([bezel='flush']) .bezel {
        --_tr-z: -2;
        --_base: var(--tr-color-well);
        padding: calc(var(--_bz) * 0.35);
      }
      :host([bezel='none']) .bezel {
        padding: 0;
        border-radius: var(--_rad);
      }

      /* ---- types ------------------------------------------------------------------------- */
      .bezel {
        /* lcd (positive): dark liquid crystal on a backlight */
        --_bg: var(--tr-display-screen, oklch(from var(--_c) calc(l * 0.55 + 0.38) calc(c * 0.85) h));
        --_ink: var(--tr-display-ink, oklch(from var(--_c) 0.2 calc(c * 0.3) calc(h + 20)));
        --_ghost: var(--tr-display-ghost, oklch(from var(--_ink) l c h / 0.075));
        --_bloom: 0;
        /* liquid crystal casts a faint shadow onto the reflector behind it */
        --_tshadow: calc(var(--_r) * 0.045em) calc(var(--_r) * 0.06em) calc(var(--_r) * 0.02em)
          oklch(from var(--_ink) l c h / calc(var(--_r) * 0.22));
        --_fshadow: drop-shadow(calc(var(--_r) * 0.045em) calc(var(--_r) * 0.06em) calc(var(--_r) * 0.015em)
          oklch(from var(--_ink) l c h / calc(var(--_r) * 0.22)));
      }
      :host([inverse]) .bezel {
        /* negative LCD: lit characters through a dark dyed polarizer */
        --_bg: var(--tr-display-screen, oklch(from var(--_c) 0.27 calc(c * 0.95) h));
        --_ink: var(--tr-display-ink, oklch(from var(--_c) 0.96 calc(c * 0.3) h));
        --_ghost: var(--tr-display-ghost, oklch(from var(--_ink) l c h / 0.07));
        --_bloom: 0.45;
      }
      :host([type='vfd']) .bezel,
      :host([type='led']) .bezel,
      :host([type='oled']) .bezel,
      :host([inverse]) .bezel {
        --_tshadow: 0 0 calc(0.03em + var(--_bloom) * var(--_glow) * 0.04em) oklch(from var(--_ink) l c h / 0.9),
          0 0 calc(var(--_bloom) * var(--_glow) * 0.28em) oklch(from var(--_ink) l c h / 0.55),
          0 0 calc(var(--_bloom) * var(--_glow) * 0.8em) oklch(from var(--_ink) l c h / 0.3);
        --_fshadow: drop-shadow(0 0 calc(var(--_bloom) * var(--_glow) * 0.025em) oklch(from var(--_ink) l c h / 0.9))
          drop-shadow(0 0 calc(var(--_bloom) * var(--_glow) * 0.12em) oklch(from var(--_ink) l c h / 0.55));
      }
      :host([type='vfd']) .bezel {
        --_bg: var(--tr-display-screen, oklch(from var(--_c) 0.16 calc(c * 0.16) h));
        --_ink: var(--tr-display-ink, oklch(from var(--_c) calc(l + 0.03) c h));
        --_ghost: var(--tr-display-ghost, oklch(from var(--_ink) calc(l * 0.75) calc(c * 0.7) h / 0.1));
        --_bloom: 1;
      }
      :host([type='led']) .bezel {
        --_bg: var(--tr-display-screen, oklch(from var(--_c) 0.12 calc(c * 0.12) h));
        --_ink: var(--tr-display-ink, oklch(from var(--_c) calc(l + 0.06) c h));
        --_ghost: var(--tr-display-ghost, oklch(from var(--_c) calc(l * 0.42) calc(c * 0.45) h / 0.5));
        --_bloom: 1.1;
      }
      :host([type='oled']) .bezel {
        --_bg: var(--tr-display-screen, oklch(9% 0.004 260));
        --_ink: var(--tr-display-ink, var(--_c));
        --_ghost: var(--tr-display-ghost, transparent);
        --_bloom: 0.3;
      }

      /* ---- screen -------------------------------------------------------------------------- */
      .screen {
        --tr-display-ink: var(--_ink);
        --tr-display-ghost: var(--_ghost);
        --tr-display-bloom: var(--_bloom);
        position: relative;
        isolation: isolate;
        display: block;
        overflow: hidden;
        border-radius: var(--_rad);
        color: var(--_ink);
        text-shadow: var(--_tshadow);
        background-color: var(--_bg);
        /* backlight: brighter in the middle, falling off toward the edges of the light guide */
        background-image: radial-gradient(
          ellipse 110% 95% at 50% 42%,
          oklch(from var(--_bg) calc(l + 0.05 * var(--_r)) c h) 0%,
          var(--_bg) 55%,
          oklch(from var(--_bg) calc(l - 0.14 * var(--_r)) calc(c * 0.9) h) 100%
        );
        /* the dark gasket between screen and bezel */
        box-shadow: 0 0 0 max(1px, 0.07em) oklch(8% 0.01 260 / calc(0.5 + var(--_r) * 0.4));
      }
      :host([type='vfd']) .screen,
      :host([type='led']) .screen {
        background-image: radial-gradient(
          ellipse 100% 90% at 50% 50%,
          oklch(from var(--_bg) calc(l + 0.025 * var(--_r)) c h) 0%,
          var(--_bg) 60%,
          oklch(from var(--_bg) calc(l * 0.6) c h) 100%
        );
      }
      :host([type='oled']) .screen {
        background-image: none;
      }
      .content {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.2em;
        padding: var(--tr-display-padding, 0.45em 0.7em);
        font-family: var(--tr-display-font, var(--tr-font-family-mono, ui-monospace, monospace));
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.04em;
      }
      .main {
        display: flex;
        align-items: baseline;
        gap: 0.4em;
        min-width: 0;
      }
      .ann {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3em 0.9em;
        font-family: var(--tr-font-family, system-ui, sans-serif);
        font-size: 0.62em;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .ann:not(.has) {
        display: none;
      }
      ::slotted([data-off]) {
        color: var(--_ghost);
        text-shadow: none;
      }
      .viewport {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
      }
      .track {
        display: block;
        width: 100%;
        white-space: nowrap;
      }
      .item.block {
        display: block;
        white-space: normal;
      }
      .item {
        display: inline-block;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        vertical-align: top;
      }
      .track[data-scroll] {
        width: max-content;
        animation: var(--_mq-anim) var(--_mq-dur, 10s) var(--_mq-ease, linear) infinite;
      }
      .track[data-scroll] .item {
        max-width: none;
        overflow: visible;
      }
      .track[data-scroll='pingpong'] {
        animation-direction: alternate;
      }
      .gap {
        display: inline-block;
        width: var(--_mq-gap, 3em);
      }
      @keyframes tr-display-loop {
        to {
          translate: calc(-1 * var(--_mq-dist, 0px)) 0;
        }
      }
      @keyframes tr-display-pingpong {
        0%,
        10% {
          translate: 0 0;
        }
        90%,
        100% {
          translate: calc(-1 * var(--_mq-dist, 0px)) 0;
        }
      }
      .readout {
        flex: 0 1 auto;
        min-width: 0;
        font-size: var(--tr-display-glyph-size, 2em);
        line-height: 1;
        font-weight: 600;
      }
      .readout .viewport {
        line-height: 1.1;
      }
      .readout.glyph .viewport {
        line-height: 0;
      }
      .readout.glyph svg {
        display: inline-block;
        height: 1em;
        overflow: visible;
        vertical-align: top;
      }
      .ghost {
        fill: var(--_ghost);
      }
      .lit {
        fill: var(--_ink);
        filter: var(--_fshadow);
      }
      .matrix .ghost,
      .matrix .lit {
        fill: none;
        stroke-width: 0.84;
        stroke-linecap: square;
      }
      .matrix .ghost {
        stroke: var(--_ghost);
      }
      .matrix .lit {
        stroke: var(--_ink);
      }
      :host([type='led']) .matrix .lit,
      :host([type='led']) .matrix .ghost {
        stroke-width: 0.74;
        stroke-linecap: round;
      }
      /* an LED panel is a uniform grid of dies: unlit dots fill the whole viewport and stay put */
      :host([type='led']) .readout.matrix .viewport {
        background: radial-gradient(circle closest-side, var(--_ghost) 72%, transparent 80%) 0 0 / 0.125em 0.125em;
      }
      /* LED text and slotted content: cut into dots by a mask, unlit dies under it */
      :host([type='led']) .dots {
        -webkit-mask: radial-gradient(circle closest-side, #000 70%, transparent 82%) 0 0 / var(--_dot) var(--_dot);
        mask: radial-gradient(circle closest-side, #000 70%, transparent 82%) 0 0 / var(--_dot) var(--_dot);
        background: var(--_ghost);
        text-shadow: none;
      }
      :host([type='led']) .content {
        --_dot: max(2px, 0.14em);
      }
      :host([type='led']) .readout:not(.matrix) .viewport {
        --_dot: max(2px, 0.09em);
      }
      :host([type='led']) .glowwrap {
        filter: drop-shadow(0 0 calc(var(--_glow) * 0.06em) oklch(from var(--_ink) l c h / 0.9))
          drop-shadow(0 0 calc(var(--_glow) * 0.3em) oklch(from var(--_ink) l c h / 0.5));
      }

      /* ---- the physics in front of the content -------------------------------------------- */
      .fx,
      .glass {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
      }
      /* lcd: the pixel / electrode grid */
      .fx {
        z-index: 1;
        background-image:
          repeating-linear-gradient(90deg, oklch(0% 0 0 / calc(var(--_r) * 0.06)) 0 1px, transparent 1px 3px),
          repeating-linear-gradient(0deg, oklch(0% 0 0 / calc(var(--_r) * 0.06)) 0 1px, transparent 1px 3px);
      }
      /* vfd: the fine control-grid mesh and the filament wires stretched across the glass */
      :host([type='vfd']) .fx {
        background-image:
          linear-gradient(
            to bottom,
            transparent calc(30% - 0.5px),
            oklch(0% 0 0 / calc(var(--_r) * 0.45)) calc(30% - 0.5px) calc(30% + 0.5px),
            transparent calc(30% + 0.5px) calc(70% - 0.5px),
            oklch(0% 0 0 / calc(var(--_r) * 0.45)) calc(70% - 0.5px) calc(70% + 0.5px),
            transparent calc(70% + 0.5px)
          ),
          repeating-linear-gradient(60deg, oklch(0% 0 0 / calc(var(--_r) * 0.3)) 0 0.6px, transparent 0.6px 3.2px),
          repeating-linear-gradient(-60deg, oklch(0% 0 0 / calc(var(--_r) * 0.3)) 0 0.6px, transparent 0.6px 3.2px);
      }
      :host([type='led']) .fx,
      :host([type='oled']) .fx {
        background-image: none;
      }
      :host([scanlines]) .fx {
        background-image: repeating-linear-gradient(
          to bottom,
          transparent 0 2px,
          oklch(0% 0 0 / calc(0.12 + var(--_r) * 0.18)) 2px 3px
        );
      }
      .glass {
        z-index: 2;
        background-image:
          /* reflection of a bright window: crisp edged, brightest toward the light */
          linear-gradient(
            calc(var(--tr-light-angle, 330deg) + 150deg),
            oklch(100% 0 0 / calc(var(--_glare) * 0.16)) 0%,
            oklch(100% 0 0 / calc(var(--_glare) * 0.07)) 38%,
            transparent 38.4%
          ),
          /* a soft sheen along the glass edge nearest the light */
          linear-gradient(
            calc(var(--tr-light-angle, 330deg) + 180deg),
            oklch(100% 0 0 / calc(var(--_glare) * 0.12)) 0,
            transparent 0.6em
          );
        box-shadow:
          /* the bezel wall casts its shadow onto the screen, on the side nearest the light */
          inset calc(var(--_sx) * (0.12em + var(--_r) * 0.25em)) calc(var(--_sy) * (0.12em + var(--_r) * 0.25em))
            calc(0.2em + var(--_r) * 0.45em) calc(var(--_r) * -0.05em) oklch(0% 0 0 / calc(0.25 + var(--_r) * 0.4)),
          /* depth: a dark rim all around where glass meets the gasket */
          inset 0 0 calc(0.1em + var(--_r) * 0.15em) oklch(0% 0 0 / calc(0.2 + var(--_r) * 0.35)),
          /* the far edge of the glass catches the light */
          inset calc(var(--_sx) * -1px) calc(var(--_sy) * -1px) 0 oklch(100% 0 0 / calc(var(--_glare) * 0.22));
      }
      :host([glare='none']) .glass {
        background-image: none;
      }

      .sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      @media (prefers-reduced-motion: reduce) {
        .track[data-scroll] {
          animation: none;
        }
      }
      @media (forced-colors: active) {
        .screen {
          forced-color-adjust: none;
          background: Canvas;
          color: CanvasText;
          text-shadow: none;
          box-shadow: 0 0 0 1px CanvasText;
        }
        .lit {
          fill: CanvasText;
          stroke: CanvasText;
          filter: none;
        }
        .ghost,
        .fx,
        .glass,
        ::slotted([data-off]) {
          display: none;
        }
        :host([type='led']) .dots,
        :host([type='led']) .glowwrap {
          -webkit-mask: none;
          mask: none;
          filter: none;
          background: none;
        }
        :host([type='led']) .readout.matrix .viewport {
          background: none;
        }
      }
    `,
  ];

  /** Screen technology. */
  @property({ reflect: true }) type: 'lcd' | 'vfd' | 'led' | 'oled' = 'lcd';

  /**
   * Backlight (LCD) or emitter (VFD, LED, OLED) color: amber, orange, green, lime, cyan, blue, red,
   * white, or any CSS color. Defaults by type: lime LCD, cyan VFD, red LED, white OLED.
   */
  @property({ reflect: true }) color?: 'amber' | 'orange' | 'green' | 'lime' | 'cyan' | 'blue' | 'red' | 'white' | (string & {});

  /** Text shown on the main line. Rendered with `glyphs`. */
  @property() value = '';

  /**
   * How `value` is drawn: text (the display font), 7seg, 14seg (alphanumeric starburst) or matrix
   * (5x8 dots). Defaults: 7seg for a numeric value with `digits`; otherwise matrix for LED, 14seg
   * with `digits`, else text.
   */
  @property({ reflect: true }) glyphs?: Glyphs;

  /**
   * Number of character cells on the main line. Unused cells show as unlit segments; longer
   * values are cut (or scrolled with `marquee`). For text glyphs it sets the width in ch.
   */
  @property({ type: Number, reflect: true }) digits?: number;

  /** Side unused cells fill from. Defaults to end (right-aligned) for numbers, start for text. */
  @property({ reflect: true }) align?: 'start' | 'end';

  /** Scrolls content that does not fit, like a car stereo or LED ticker. Off under reduced motion. */
  @property({ type: Boolean, reflect: true }) marquee = false;

  /** Marquee speed in characters per second. */
  @property({ type: Number, attribute: 'marquee-speed' }) marqueeSpeed = 4;

  /** Negative LCD: lit characters on a dark dyed screen (LCD only). */
  @property({ type: Boolean, reflect: true }) inverse = false;

  /** Adds CRT-like scanlines. */
  @property({ type: Boolean, reflect: true }) scanlines = false;

  /** Frame around the screen: a raised frame of the current material, a flush recess, or none. */
  @property({ reflect: true }) bezel: 'frame' | 'flush' | 'none' = 'frame';

  /** Glass reflection: none removes it (the bezel shadow stays). */
  @property({ reflect: true }) glare: 'auto' | 'none' = 'auto';

  /** Announces changes to screen readers (aria-live="polite"). */
  @property({ type: Boolean, reflect: true }) live = false;

  @state() private mqMode: '' | 'loop' | 'pingpong' = '';
  @state() private tick = 0;
  @state() private hasTop = false;
  @state() private hasBottom = false;

  @query('.viewport') private viewportEl?: HTMLElement;
  @query('.item') private itemEl?: HTMLElement;
  @query('.track') private trackEl?: HTMLElement;

  private ro?: ResizeObserver;
  private ticker = 0;
  private mqDist = 0;
  private mqDur = 0;
  private mqSteps = 0;

  /** The glyph style in effect. */
  get effectiveGlyphs(): Glyphs {
    if (this.glyphs) return this.glyphs;
    if (this.digits && this.numeric) return '7seg';
    if (this.type === 'led') return 'matrix';
    return this.digits ? '14seg' : 'text';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro ??= new ResizeObserver(() => this.measure());
      queueMicrotask(() => this.observe());
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
    clearInterval(this.ticker);
    this.ticker = 0;
  }

  private observe(): void {
    if (!this.ro || !this.isConnected) return;
    this.ro.disconnect();
    if (this.viewportEl) this.ro.observe(this.viewportEl);
    if (this.itemEl) this.ro.observe(this.itemEl);
  }

  /** True when the main line is drawn as fixed cells that scroll a character at a time. */
  private get cellTicker(): boolean {
    const g = this.effectiveGlyphs;
    return !!this.digits && g !== 'text' && !(g === 'matrix' && this.type === 'led');
  }

  private get numeric(): boolean {
    return /^[\s\d.,:+\-°]*$/.test(this.value);
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('value') || changed.has('digits') || changed.has('glyphs')) this.tick = 0;
  }

  protected override render() {
    const named = this.color ? displayColors[this.color] : undefined;
    const colorVar = named ?? this.color ?? displayColors[TYPE_COLOR[this.type] ?? 'lime'];
    const bezelStyle = { '--_attr-c': this.color ? colorVar! : `var(--tr-display-color, ${colorVar})` };
    const led = this.type === 'led';
    return html`<div part="bezel" class="bezel ${this.bezel === 'none' ? '' : 'surface'}" style=${styleMap(bezelStyle)}>
      <div part="screen" class="screen">
        <div class="glowwrap">
          <div part="content" class="content ${led && this.effectiveGlyphs !== 'matrix' ? 'dots' : ''}">
            <div class="ann top ${this.hasTop ? 'has' : ''}"><slot name="top" @slotchange=${this.onSlotChange}></slot></div>
            <div class="main">
              ${this.value !== '' ? this.renderReadout() : nothing}
              ${this.value === ''
                ? html`<div class="viewport"><div class="track" data-scroll=${this.mqMode || nothing} style=${styleMap(this.marqueeStyle())}><span class="item block"><slot></slot></span></div></div>`
                : html`<slot></slot>`}
            </div>
            <div class="ann bottom ${this.hasBottom ? 'has' : ''}"><slot name="bottom" @slotchange=${this.onSlotChange}></slot></div>
          </div>
        </div>
        <div class="fx"></div>
        <div part="glass" class="glass"></div>
      </div>
    </div>`;
  }

  private marqueeStyle(): Record<string, string> {
    if (!this.mqMode) return {};
    return {
      '--_mq-anim': this.mqMode === 'loop' ? 'tr-display-loop' : 'tr-display-pingpong',
      '--_mq-dist': `${this.mqDist}px`,
      '--_mq-dur': `${this.mqDur}s`,
      '--_mq-ease': this.mqSteps ? `steps(${this.mqSteps})` : 'linear',
    };
  }

  private renderReadout() {
    const g = this.effectiveGlyphs;
    const copy = this.mqMode === 'loop';
    if (g === 'text') {
      const width = this.digits ? { width: `${this.digits}ch` } : {};
      return html`<div part="readout" class="readout text" style=${styleMap(width)}>
        <div class="viewport">
          <div class="track" data-scroll=${this.mqMode || nothing} style=${styleMap(this.marqueeStyle())}>
            <span class="item">${this.value}</span>${copy ? html`<span class="gap"></span><span class="item" aria-hidden="true">${this.value}</span>` : nothing}
          </div>
        </div>
      </div>`;
    }
    const art = this.glyphSvg(g);
    const style: Record<string, string> = { '--_mq-gap': g === 'matrix' ? '0.75em' : '1em' };
    if (g === 'matrix' && this.type === 'led' && this.digits) style.width = `${(this.digits * 6 - 1) / 8}em`;
    return html`<div part="readout" class="readout glyph ${g === 'matrix' ? 'matrix' : 'seg'}">
      <span class="sr">${this.value}</span>
      <div class="viewport" style=${styleMap(style)}>
        <div class="track" data-scroll=${this.mqMode || nothing} style=${styleMap(this.marqueeStyle())}>
          <span class="item">${art}</span>${copy ? html`<span class="gap"></span><span class="item">${art}</span>` : nothing}
        </div>
      </div>
    </div>`;
  }

  private glyphSvg(g: Exclude<Glyphs, 'text'>) {
    const digits = Math.max(0, Math.floor(this.digits ?? 0));
    const alignEnd = this.align ? this.align === 'end' : this.numeric;
    let paths: { ghost: string; lit: string; width: number; height: number };
    if (g === 'matrix') {
      let text = this.value;
      if (digits && this.cellTicker) text = this.windowText([...text], digits).join('');
      paths = matrixPaths(text, this.type !== 'led');
    } else {
      let cells = toCells(this.value);
      if (digits) {
        const count = cells.filter((c) => !c.colon).length;
        if (count < digits) {
          const pad = Array.from({ length: digits - count }, blankCell);
          cells = alignEnd ? [...pad, ...cells] : [...cells, ...pad];
        } else if (count > digits) {
          cells = this.windowText(cells, digits);
        }
      }
      paths = segmentPaths(cells, g);
    }
    const { width, height } = paths;
    // Italic like real segment glass: skew around the baseline, leaving room at the top.
    const skew = g === 'matrix' ? 0 : Math.tan((7 * Math.PI) / 180) * height;
    const vbW = width + skew;
    return html`<svg
      class=${g === 'matrix' ? 'matrix' : 'seg'}
      viewBox="0 0 ${vbW} ${height}"
      style="width:${vbW / height}em"
      aria-hidden="true"
      focusable="false"
    >${svg`<g transform=${skew ? `translate(${skew} 0) skewX(-7)` : ''}><path class="ghost" d=${paths.ghost}></path><path class="lit" d=${paths.lit}></path></g>`}</svg>`;
  }

  /** A `digits`-long window into a longer line: scrolled by the ticker, or the first cells. */
  private windowText<T extends Cell | string>(items: T[], digits: number): T[] {
    const isCell = typeof items[0] === 'object';
    const real = isCell ? (items as Cell[]).filter((c) => !c.colon) : items;
    if (real.length <= digits) return items;
    if (!this.ticker) return real.slice(0, digits) as T[];
    const blank = (isCell ? blankCell() : ' ') as T;
    const ring = [...(real as T[]), blank, blank, blank];
    return Array.from({ length: digits }, (_, i) => ring[(this.tick + i) % ring.length]!);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('live')) {
      if (this.live) {
        this.setAttribute('aria-live', 'polite');
        this.setAttribute('aria-atomic', 'true');
      } else if (changed.get('live') !== undefined) {
        this.removeAttribute('aria-live');
        this.removeAttribute('aria-atomic');
      }
    }
    this.syncTicker();
    if (!this.mqMode || changed.has('value') || changed.has('glyphs') || changed.has('digits')) this.observe();
    this.measure();
  }

  private syncTicker(): void {
    const g = this.effectiveGlyphs;
    let count = 0;
    if (this.cellTicker) {
      count = g === 'matrix' ? [...this.value].length : toCells(this.value).filter((c) => !c.colon).length;
    }
    const want = this.marquee && this.cellTicker && count > (this.digits ?? 0) && !reducedMotion();
    const rate = Math.max(0.5, this.marqueeSpeed || 4);
    if (want && !this.ticker) {
      this.ticker = window.setInterval(() => {
        this.tick = (this.tick + 1) % (count + 3);
      }, 1000 / rate);
      this.requestUpdate();
    } else if (!want && this.ticker) {
      clearInterval(this.ticker);
      this.ticker = 0;
      this.tick = 0;
    }
  }

  /** Decides whether the main line overflows and how to scroll it. Cheap, and only writes on change. */
  private measure(): void {
    const vp = this.viewportEl;
    const item = this.itemEl;
    if (!vp || !item) return;
    let mode: '' | 'loop' | 'pingpong' = '';
    const fit = vp.clientWidth;
    const natural = item.scrollWidth;
    if (this.marquee && !this.cellTicker && !reducedMotion() && natural > fit + 1) {
      mode = this.value !== '' ? 'loop' : 'pingpong';
    }
    if (mode !== this.mqMode) {
      this.mqMode = mode;
      return;
    }
    if (!mode) return;
    const fontPx = parseFloat(getComputedStyle(item).fontSize) || 16;
    const g = this.effectiveGlyphs;
    const charPx = g === 'matrix' ? fontPx * 0.75 : g === 'text' ? fontPx * 0.62 : fontPx * 0.8;
    const pxPerS = charPx * Math.max(0.5, this.marqueeSpeed || 4);
    let dist: number;
    if (mode === 'loop') {
      const copy = item.parentElement?.querySelectorAll('.item')[1] as HTMLElement | undefined;
      dist = copy ? copy.offsetLeft - item.offsetLeft : natural;
    } else {
      dist = natural - fit;
    }
    // An LED panel moves one column of dies at a time.
    const steps = this.type === 'led' && g === 'matrix' ? Math.max(1, Math.round(dist / (fontPx / 8))) : 0;
    const dur = Math.max(1, dist / pxPerS) * (mode === 'pingpong' ? 1.25 : 1);
    if (Math.abs(dist - this.mqDist) > 0.5 || steps !== this.mqSteps || Math.abs(dur - this.mqDur) > 0.05) {
      this.mqDist = dist;
      this.mqDur = Number(dur.toFixed(2));
      this.mqSteps = steps;
      if (this.trackEl) {
        const s = this.marqueeStyle();
        for (const [k, v] of Object.entries(s)) this.trackEl.style.setProperty(k, v);
      }
    }
  }

  private onSlotChange(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    const has = slot.assignedNodes({ flatten: true }).some((n) => n.nodeType === 1 || (n.textContent ?? '').trim());
    if (slot.name === 'top') this.hasTop = has;
    else this.hasBottom = has;
  }
}

define('tr-display', TrDisplay);

declare global {
  interface HTMLElementTagNameMap {
    'tr-display': TrDisplay;
  }
}
