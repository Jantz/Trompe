import { css, html, nothing, svg, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import { iconMarkup, onIconsChange } from './icons.js';

const warned = new Set<string>();

/**
 * An icon from Trompe's built-in set (or your own, via `registerIcons`), drawn the way a mark
 * sits on a real surface: printed in ink, engraved into it, embossed out of it, or lit from behind
 * like a backlit key legend. Engraved and embossed take their highlight and shadow from the scene
 * light (`--tr-light-angle`) and realism, like every other Trompe surface.
 *
 * Icons are 1em square by default, so they line up with the text beside them in buttons, inputs,
 * list items, nav items, menu items and badges. The box never changes size: changing `name`
 * cross-fades the glyphs in place.
 *
 * Without `label` the icon is decorative (hidden from screen readers), which is right next to a
 * text label. Give an icon-only button its name on the button (`aria-label`), or give the icon a
 * `label`. `iconNames()` lists every name.
 *
 * @summary Icon: a stroked glyph, printed, engraved, embossed or backlit to match the material.
 * @tag tr-icon
 *
 * @csspart svg - The SVG element.
 *
 * @cssprop --tr-icon-size - Width and height. Defaults by `size` (1em, or 12, 16, 20, 24, 32px).
 * @cssprop --tr-icon-color - Ink colour. Defaults by `tone` (the surrounding text colour).
 * @cssprop --tr-icon-stroke - Stroke width on the 24-unit grid. Defaults to 1.75.
 *
 * @example <tr-icon name="search"></tr-icon>
 * @example <tr-button><tr-icon slot="start" name="download"></tr-icon>Export</tr-button>
 * @example <tr-button shape="circle" aria-label="Settings"><tr-icon name="settings"></tr-icon></tr-button>
 * @example <tr-icon name="lock" variant="engraved" size="lg"></tr-icon>
 * @example <tr-icon name="bolt" variant="lit" tone="warning" label="Charging"></tr-icon>
 * @example <tr-list-item><tr-icon slot="start" name="bell"></tr-icon>Notifications</tr-list-item>
 */
export class TrIcon extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_size: var(--tr-icon-size, 1em);
        --_tone: var(--tr-icon-color, currentColor);
        --_hlc: var(--tr-color-highlight, #fff);
        --_shc: var(--tr-color-shadow, #000);
        /* relief offset: grows with the icon and with realism */
        --_d: calc(var(--_size) * 0.045 * (0.35 + var(--_r)));
        display: inline-block;
        position: relative;
        flex: none;
        width: var(--_size);
        height: var(--_size);
        vertical-align: -0.15em;
        line-height: 0;
        color: var(--_tone);
        transition: color var(--tr-motion-duration-release, 160ms) ease-out;
      }
      :host([size='xs']) { --_size: var(--tr-icon-size, 12px); }
      :host([size='sm']) { --_size: var(--tr-icon-size, 16px); }
      :host([size='md']) { --_size: var(--tr-icon-size, 20px); }
      :host([size='lg']) { --_size: var(--tr-icon-size, 24px); }
      :host([size='xl']) { --_size: var(--tr-icon-size, 32px); }
      :host([tone='accent']) { --_tone: var(--tr-icon-color, var(--tr-color-accent)); }
      :host([tone='success']) { --_tone: var(--tr-icon-color, var(--tr-color-success)); }
      :host([tone='warning']) { --_tone: var(--tr-icon-color, var(--tr-color-warning)); }
      :host([tone='danger']) { --_tone: var(--tr-icon-color, var(--tr-color-danger)); }
      :host([tone='muted']) { --_tone: var(--tr-icon-color, var(--tr-color-ink-muted)); }

      svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        fill: none;
        stroke: currentColor;
        stroke-width: var(--tr-icon-stroke, 1.75);
        stroke-linecap: round;
        stroke-linejoin: round;
        /* three relief layers, always present so a change of variant interpolates:
           A a crisp copy (lip or highlight), B a soft copy (shadow), G a glow */
        --_ax: 0px;
        --_ay: 0px;
        --_a: transparent;
        --_bx: 0px;
        --_by: 0px;
        --_bb: 0px;
        --_b: transparent;
        --_gb: 0px;
        --_g: transparent;
        filter: drop-shadow(var(--_ax) var(--_ay) 0 var(--_a)) drop-shadow(var(--_bx) var(--_by) var(--_bb) var(--_b))
          drop-shadow(0 0 var(--_gb) var(--_g));
        transition:
          opacity var(--tr-motion-duration-lift, 240ms) ease-out,
          scale var(--tr-motion-duration-lift, 240ms) var(--tr-motion-easing-settle, ease-out),
          color var(--tr-motion-duration-release, 160ms) ease-out,
          filter var(--tr-motion-duration-release, 160ms) ease-out;
      }
      /* a new glyph fades and settles in where the old one fades out */
      @starting-style {
        svg.in {
          opacity: 0;
          scale: 0.85;
        }
      }
      svg.out {
        opacity: 0;
        scale: 0.85;
      }

      /* Engraved: the stroke is a groove cut into the surface, like letterpress. Its floor is a
         shade of the ink softened by the material, the wall nearest the light falls into shadow
         (a dark edge toward the light) and the far wall catches it (a bright lip away from it). */
      :host([variant='engraved']) svg {
        color: color-mix(in oklch, var(--_tone) calc(88% - var(--_r) * 22%), var(--_m-base));
        --_ax: calc(var(--_sx) * var(--_d));
        --_ay: calc(var(--_sy) * var(--_d));
        --_a: color-mix(in oklab, var(--_hlc) calc(35% + var(--_r) * 60%), transparent);
        --_bx: calc(var(--_sx) * var(--_d) * -0.7);
        --_by: calc(var(--_sy) * var(--_d) * -0.7);
        --_bb: 0px;
        --_b: color-mix(in oklch, var(--_shc) calc(10% + var(--_r) * 30%), transparent);
      }
      /* Embossed: the stroke stands up from the surface, lit on the side facing the light and
         casting a soft shadow away from it. */
      :host([variant='embossed']) svg {
        --_ax: calc(var(--_sx) * var(--_d) * -0.8);
        --_ay: calc(var(--_sy) * var(--_d) * -0.8);
        --_a: color-mix(in oklab, var(--_hlc) calc(40% + var(--_r) * 60%), transparent);
        --_bx: calc(var(--_sx) * var(--_d) * 1.35);
        --_by: calc(var(--_sy) * var(--_d) * 1.35);
        --_bb: calc(var(--_d) * 1.1);
        --_b: color-mix(in oklch, var(--_shc) calc(20% + var(--_r) * 40%), transparent);
      }
      /* Lit: a backlit legend. The glyph is the light, with a bright core and a halo. */
      :host([variant='lit']) {
        --_tone: var(--tr-icon-color, var(--tr-color-accent));
      }
      :host([variant='lit']:is([tone='success'], [tone='warning'], [tone='danger'], [tone='muted'])) {
        --_tone: var(--tr-icon-color, var(--_lit-tone));
      }
      :host([variant='lit'][tone='success']) { --_lit-tone: var(--tr-color-success); }
      :host([variant='lit'][tone='warning']) { --_lit-tone: var(--tr-color-warning); }
      :host([variant='lit'][tone='danger']) { --_lit-tone: var(--tr-color-danger); }
      :host([variant='lit'][tone='muted']) { --_lit-tone: var(--tr-color-ink-muted); }
      :host([variant='lit']) svg {
        color: color-mix(in oklab, var(--_tone) 72%, white);
        --_a: color-mix(in oklch, var(--_tone) 85%, transparent);
        --_bb: calc(var(--_size) * 0.06);
        --_b: color-mix(in oklch, var(--_tone) calc(40% + var(--_r) * 40%), transparent);
        --_gb: calc(var(--_size) * (0.1 + var(--_r) * 0.12));
        --_g: color-mix(in oklch, var(--_tone) calc(25% + var(--_r) * 35%), transparent);
      }

      @media (forced-colors: active) {
        svg {
          filter: none;
          color: CanvasText;
        }
      }
    `,
  ];

  /** Icon name, from the built-in set or one you added with `registerIcons`. */
  @property({ reflect: true }) name = '';

  /** Width and height. Unset follows the text size (1em). */
  @property({ reflect: true }) size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /** How the mark sits on the surface: printed ink, engraved (cut in), embossed (raised) or lit (backlit). */
  @property({ reflect: true }) variant: 'printed' | 'engraved' | 'embossed' | 'lit' = 'printed';

  /** Colour. `inherit` uses the surrounding text colour (accent for `lit`). */
  @property({ reflect: true }) tone: 'inherit' | 'accent' | 'success' | 'warning' | 'danger' | 'muted' = 'inherit';

  /** What the icon means, read by screen readers. Leave empty when text next to it says the same. */
  @property({ reflect: true }) label = '';

  /** The glyph being replaced, kept while it fades out. */
  @state() private previous = '';

  private unlisten?: () => void;

  override connectedCallback(): void {
    super.connectedCallback();
    this.unlisten = onIconsChange(() => this.requestUpdate());
    this.syncA11y();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unlisten?.();
  }

  protected override willUpdate(changed: PropertyValues): void {
    const old = changed.get('name') as string | undefined;
    if (changed.has('name') && old && this.hasUpdated) this.previous = old;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('label')) this.syncA11y();
    // No transition runs under reduced motion: drop the old glyph at once.
    const out = this.previous ? this.renderRoot.querySelector('svg.out') : null;
    if (out && getComputedStyle(out).transitionDuration.split(',').every((d) => parseFloat(d) === 0)) this.previous = '';
  }

  private syncA11y(): void {
    if (this.label) {
      this.setAttribute('role', 'img');
      this.setAttribute('aria-label', this.label);
      this.removeAttribute('aria-hidden');
    } else {
      this.removeAttribute('role');
      this.removeAttribute('aria-label');
      this.setAttribute('aria-hidden', 'true');
    }
  }

  private glyph(name: string, cls: string) {
    const markup = iconMarkup(name);
    if (markup === undefined) {
      if (name && !warned.has(name)) {
        warned.add(name);
        console.warn(`tr-icon: no icon named "${name}". iconNames() lists them; registerIcons() adds your own.`);
      }
      return nothing;
    }
    return svg`<svg part="svg" class=${cls} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      @transitionend=${cls === 'out' ? this.onOutEnd : nothing}>${unsafeSVG(markup)}</svg>`;
  }

  private onOutEnd = (e: TransitionEvent): void => {
    if (e.propertyName === 'opacity') this.previous = '';
  };

  protected override render() {
    const prev = this.previous && this.previous !== this.name ? this.previous : '';
    // Only a replacement fades in; icons on a fresh page are simply there. The old glyph keeps its
    // element (keyed by name) and fades out in place.
    const swapped = this.hasUpdated && this.previous !== '';
    const glyphs = prev ? [prev, this.name] : [this.name];
    return html`${repeat(glyphs, (n) => n, (n) => this.glyph(n, n === prev ? 'out' : swapped ? 'in' : ''))}`;
  }
}

define('tr-icon', TrIcon);

declare global {
  interface HTMLElementTagNameMap {
    'tr-icon': TrIcon;
  }
}

// So `import { iconNames, registerIcons } from 'trompe/components/icon'` works as well as the root import.
export { registerIcons, iconNames } from './icons.js';
