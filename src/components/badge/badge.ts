import { SizeTransition, crossfadeText } from '../../interaction/smooth.js';
import { css, html, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import { materialDefaults } from '../../generated/tokens.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';

/**
 * A small status tag or count. Three physical treatments:
 * - `enamel` (default): a raised, glossy pill of colored enamel, like a cloisonné pin.
 * - `plate`: a flat engraved nameplate in the surrounding material; the tone shows as filled
 *   lettering and a colored inlay stripe.
 * - `well`: a shallow recessed pocket tinted with the tone, quiet enough for dense tables.
 *
 * Add `dot` for a small indicator LED before the text; `pulse` makes it breathe (not under
 * reduced motion). Tone is always paired with the text, so it never carries meaning by color
 * alone. Purely presentational (no role): for live counts, wrap it in an element with
 * aria-live, and give a dot-only badge a `label`.
 *
 * Success and warning colors are derived from the theme's danger token (same lightness and
 * chroma, rotated hue) until the token set defines them.
 *
 * @summary Status pill, tag or count.
 * @tag tr-badge
 *
 * @slot - Badge text.
 * @slot start - Icon before the text.
 *
 * @csspart badge - The badge surface.
 * @csspart dot - The indicator LED.
 *
 * @cssprop --tr-badge-color - Tone color. Defaults by `tone`.
 * @cssprop --tr-badge-ink - Text color on enamel. Defaults by `tone`.
 * @cssprop --tr-badge-success - Success color. Defaults to the danger token rotated to green.
 * @cssprop --tr-badge-success-ink - Text on success enamel.
 * @cssprop --tr-badge-warning - Warning color. Defaults to the danger token rotated to amber.
 * @cssprop --tr-badge-warning-ink - Text on warning enamel.
 * @cssprop --tr-badge-radius - Corner radius. Defaults to a pill.
 *
 * @example <tr-badge tone="success" dot>Online</tr-badge>
 * @example <tr-badge tone="accent">3</tr-badge>
 * @example <tr-badge variant="plate" material="metal">v2.4</tr-badge>
 * @example <tr-badge variant="well" tone="warning">Pending</tr-badge>
 */
export class TrBadge extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_success: var(--tr-badge-success, oklch(from var(--tr-color-danger) calc(l + 0.02) calc(c * 0.8) 150));
        --_success-ink: var(--tr-badge-success-ink, var(--tr-color-danger-ink));
        --_warning: var(--tr-badge-warning, oklch(from var(--tr-color-danger) max(l + 0.2, 0.78) calc(c * 0.85) 80));
        --_warning-ink: var(--tr-badge-warning-ink, oklch(from var(--tr-color-danger) 0.25 0.05 70));
        --_tone: var(--tr-badge-color, color-mix(in oklch, var(--tr-color-ink, currentColor) 55%, var(--tr-color-surface)));
        --_tone-ink: var(--tr-badge-ink, var(--tr-color-surface));
        display: inline-flex;
        vertical-align: middle;
        font-size: 0.75em;
        line-height: 1;
        /* --_tone and --_tone-ink are registered: a tone change fades the enamel */
        /* enamel colours: the tone, or the material itself for neutral */
        --_eb: var(--_tone);
        --_ei: var(--_tone-ink);
        --_ee: color-mix(in oklch, var(--_tone), var(--tr-color-shadow, #000) 30%);
        transition:
          --_tone var(--tr-motion-duration-travel, 220ms) ease-out,
          --_tone-ink var(--tr-motion-duration-travel, 220ms) ease-out,
          --_eb var(--tr-motion-duration-travel, 220ms) ease-out,
          --_ei var(--tr-motion-duration-travel, 220ms) ease-out,
          --_ee var(--tr-motion-duration-travel, 220ms) ease-out;
      }
      :host([tone='neutral']),
      :host(:not([tone])) {
        --_eb: var(--_m-base);
        --_ei: var(--_m-ink);
        --_ee: var(--tr-color-edge);
      }
      /* The text box glides to a new width (a count going from 9 to 10) instead of jumping. */
      .text-box {
        display: inline-flex;
      }
      :host([size='md']) {
        font-size: 0.875em;
      }
      :host([tone='accent']) {
        --_tone: var(--tr-badge-color, var(--tr-color-accent));
        --_tone-ink: var(--tr-badge-ink, var(--tr-color-accent-ink));
      }
      :host([tone='danger']) {
        --_tone: var(--tr-badge-color, var(--tr-color-danger));
        --_tone-ink: var(--tr-badge-ink, var(--tr-color-danger-ink));
      }
      :host([tone='success']) {
        --_tone: var(--tr-badge-color, var(--_success));
        --_tone-ink: var(--tr-badge-ink, var(--_success-ink));
      }
      :host([tone='warning']) {
        --_tone: var(--tr-badge-color, var(--_warning));
        --_tone-ink: var(--tr-badge-ink, var(--_warning-ink));
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4em;
        min-width: 1.75em;
        min-height: 1.75em;
        justify-content: center;
        padding: 0.3em 0.6em;
        border-radius: var(--tr-badge-radius, var(--tr-radius-pill, 999px));
        font-weight: var(--tr-font-weight-strong, 600);
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }
      /* enamel: glossy colored pill */
      :host([variant='enamel']) .badge {
        --_tr-z: 1;
        --_base: var(--_eb);
        --_ink: var(--_ei);
        --_edge: var(--_ee);
        /* read the gloss upstream, as surface.ts resolves it: var(--_gloss) here would be a cycle */
        --_gloss: max(var(--tr-f-gloss, var(--tr-m-gloss, ${unsafeCSS((materialDefaults as Record<string, string>).gloss)})), 0.55);
        --_curve: 0.5;
      }
      /* plate: engraved lettering on the surrounding material, a colored inlay stripe */
      :host([variant='plate']) .badge {
        --_tr-z: 0.5;
        --_chamfer: calc(var(--_r) * 1.5px);
        border-radius: var(--tr-badge-radius, var(--tr-radius-sm, 4px));
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.92em;
        --_ink: color-mix(in oklch, var(--_tone), var(--_m-ink) 35%);
        /* cut letters: dark on the edge facing the light, lit on the far edge */
        text-shadow:
          0 calc(var(--_sy) * 1px) 0 color-mix(in oklch, var(--_hl) calc(var(--_r) * 70%), transparent),
          0 calc(var(--_sy) * -1px) 0 color-mix(in oklch, var(--_sh) calc(var(--_r) * 30%), transparent);
        padding-inline-start: 0.85em;
        --_layer: linear-gradient(to right, var(--_tone) 0 0.22em, transparent 0.22em);
      }
      :host([variant='plate'][tone='neutral']) .badge {
        --_ink: var(--_m-ink);
        --_layer: none;
        padding-inline-start: 0.6em;
      }
      /* well: a shallow tinted pocket */
      :host([variant='well']) .badge {
        --_tr-z: -1;
        --_base: color-mix(in oklch, color-mix(in oklch, var(--_tone) 16%, var(--_m-base)), var(--_sh) 4%);
        --_ink: color-mix(in oklch, var(--_tone), var(--_m-ink) 50%);
        --_edge: color-mix(in oklch, var(--_tone) 45%, var(--tr-color-edge));
      }
      :host([variant='well'][tone='neutral']) .badge {
        --_ink: color-mix(in oklch, var(--_m-ink) 80%, var(--_base));
      }
      .dot {
        flex: none;
        width: 0.6em;
        height: 0.6em;
        border-radius: 50%;
        background: radial-gradient(circle at 35% 30%, color-mix(in oklch, white 70%, var(--_tone)), var(--_tone) 55%, color-mix(in oklch, var(--_tone), black 25%));
        box-shadow:
          0 0 0 1px color-mix(in oklch, var(--_sh) calc(15% + var(--_r) * 20%), transparent),
          0 0 calc(2px + var(--_r) * 5px) color-mix(in oklch, var(--_tone) 80%, transparent);
      }
      :host([variant='enamel']:not([tone='neutral'])) .dot {
        background: radial-gradient(circle at 35% 30%, white, color-mix(in oklch, var(--_tone-ink), var(--_tone) 20%) 60%);
        box-shadow: 0 0 calc(2px + var(--_r) * 4px) color-mix(in oklch, var(--_tone-ink) 70%, transparent);
      }
      :host([pulse]) .dot {
        animation: tr-badge-pulse 1.6s ease-in-out infinite;
      }
      @keyframes tr-badge-pulse {
        50% {
          opacity: 0.45;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        :host([pulse]) .dot {
          animation: none;
        }
      }
      .dot[hidden],
      .text:not(.has) {
        display: none;
      }
      ::slotted(svg) {
        width: 1em;
        height: 1em;
      }
      @media (forced-colors: active) {
        .badge {
          border: 1px solid CanvasText;
        }
        .dot {
          background: CanvasText;
          forced-color-adjust: none;
        }
      }
    `,
  ];

  /** Meaning of the badge. Always pair it with text that says the same. */
  @property({ reflect: true }) tone: 'neutral' | 'accent' | 'danger' | 'success' | 'warning' = 'neutral';

  /** Physical treatment: raised enamel pill, engraved plate, or recessed well. */
  @property({ reflect: true }) variant: 'enamel' | 'plate' | 'well' = 'enamel';

  /** Size of the badge: sm suits counts inside tabs and nav items. */
  @property({ reflect: true }) size: 'sm' | 'md' = 'sm';

  /** Shows an indicator LED before the text. */
  @property({ type: Boolean, reflect: true }) dot = false;

  /** Makes the LED breathe, for live states. Off under reduced motion. */
  @property({ type: Boolean, reflect: true }) pulse = false;

  /** Accessible text for a badge with no visible text (a lone dot). */
  @property() label = '';

  private hasText = true;
  private shownText: string | null = null;
  private textObserver: MutationObserver | null = null;
  protected readonly textSize = new SizeTransition(
    this,
    () => ({ outer: this.renderRoot?.querySelector<HTMLElement>('.text-box'), inner: this.renderRoot?.querySelector<HTMLElement>('.text') }),
    { axis: 'inline' },
  );

  override connectedCallback(): void {
    super.connectedCallback();
    // New text (a changing count) cross-fades over the old.
    this.textObserver ??= new MutationObserver(() => this.onTextChange());
    this.textObserver.observe(this, { childList: true, characterData: true, subtree: true });
    this.shownText = this.textContent ?? '';
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.textObserver?.disconnect();
  }

  private onTextChange(): void {
    const now = this.textContent ?? '';
    const before = this.shownText;
    this.shownText = now;
    if (before === null || before === now || !this.hasUpdated) return;
    crossfadeText(this.renderRoot.querySelector<HTMLElement>('.text'), before.trim(), { duration: 160 });
  }

  protected override render() {
    return html`<span part="badge" class="badge surface">
      <span part="dot" class="dot" ?hidden=${!this.dot} aria-hidden="true"></span>
      <slot name="start"></slot>
      <span class="text-box"><span class="text ${this.hasText ? 'has' : ''}"><slot @slotchange=${this.onSlot}></slot></span></span>
      ${this.label ? html`<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)">${this.label}</span>` : ''}
    </span>`;
  }

  private onSlot(e: Event): void {
    const has = (e.target as HTMLSlotElement).assignedNodes({ flatten: true }).some((n) => n.nodeType === 1 || n.textContent?.trim());
    if (has !== this.hasText) {
      this.hasText = has;
      this.requestUpdate();
    }
  }
}

define('tr-badge', TrBadge);

declare global {
  interface HTMLElementTagNameMap {
    'tr-badge': TrBadge;
  }
}
