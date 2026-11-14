import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import type { Orientation } from '../../internal/types.js';

/**
 * A navigation landmark: a sidebar panel (vertical, default) or a top bar (horizontal) holding
 * tr-nav-item links. The current page's item is pressed into the panel with a lit indicator
 * beside it. Navigation stays native: every item is a real link (or button) in the Tab order,
 * so there is no arrow-key handling to learn.
 *
 * @summary Navigation landmark (role="navigation") for sidebars and top bars.
 * @tag tr-nav
 * @role navigation
 *
 * @slot - tr-nav-item elements, and optionally headings (`<h2>`, `[slot]`-less text) between groups.
 * @slot header - Content above the items, such as a logo or workspace switcher.
 * @slot footer - Content pinned below the items, such as the account item.
 *
 * @csspart panel - The panel surface.
 * @csspart items - Wrapper around the items.
 *
 * @cssprop --tr-nav-width - Width of a vertical nav. Defaults to auto (fills its container).
 * @cssprop --tr-nav-padding - Inner padding. Defaults to 0.5em.
 * @cssprop --tr-nav-gap - Space between items. Defaults to 0.15em.
 * @cssprop --tr-nav-radius - Corner radius of the panel. Defaults to --tr-radius-lg.
 *
 * @example <tr-nav label="Main"><tr-nav-item href="/" current>Home</tr-nav-item><tr-nav-item href="/inbox">Inbox <tr-badge slot="badge">4</tr-badge></tr-nav-item></tr-nav>
 * @example <tr-nav label="Sections" orientation="horizontal" variant="flush">…</tr-nav>
 */
export class TrNav extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_pad: var(--tr-nav-padding, 0.5em);
        display: block;
        width: var(--tr-nav-width, auto);
        font-size: var(--tr-font-size-md, 1em);
      }
      .panel {
        --_tr-z: 1;
        /* a broad content surface: tame clear-coat and mirror reflections so text stays legible */
        --_gloss: calc(var(--tr-f-gloss, var(--tr-m-gloss, 0)) * 0.3);
        --_mirror: calc(var(--tr-f-mirror, var(--tr-m-mirror, 0)) * 0.3);
        display: flex;
        flex-direction: column;
        gap: 0.5em;
        height: 100%;
        padding: var(--_pad);
        border-radius: var(--tr-nav-radius, var(--tr-radius-lg, 16px));
      }
      :host([variant='flush']) .panel {
        background: none;
        border-color: transparent;
        box-shadow: none;
      }
      :host([variant='flush']) .panel::before {
        display: none;
      }
      :host([variant='inset']) .panel {
        --_tr-z: -1;
        --_base: color-mix(in oklch, var(--_m-base), var(--_sh) calc(5% + var(--tr-lift, 0) * 8%));
      }
      .items {
        display: flex;
        flex-direction: column;
        gap: var(--tr-nav-gap, 0.15em);
        flex: 1;
      }
      :host([orientation='horizontal']) .panel {
        flex-direction: row;
        align-items: center;
      }
      :host([orientation='horizontal']) .items {
        flex-direction: row;
        align-items: center;
        flex-wrap: wrap;
      }
      .header:not(.has),
      .footer:not(.has) {
        display: none;
      }
      .header,
      .footer {
        display: flex;
        flex-direction: column;
        gap: 0.15em;
      }
      .header {
        padding: 0.25em 0.25em 0.6em;
        border-bottom: 1px solid color-mix(in oklch, var(--_sh) calc(14% + var(--_r) * 14%), transparent);
        box-shadow: 0 1px 0 color-mix(in oklch, var(--_hl) calc(var(--_r) * 55%), transparent);
      }
      .footer {
        padding-top: 0.6em;
        border-top: 1px solid color-mix(in oklch, var(--_sh) calc(14% + var(--_r) * 14%), transparent);
        box-shadow: inset 0 1px 0 color-mix(in oklch, var(--_hl) calc(var(--_r) * 55%), transparent);
      }
      :host([orientation='horizontal']) .header,
      :host([orientation='horizontal']) .footer {
        flex-direction: row;
        align-items: center;
        border: 0;
        box-shadow: none;
        padding: 0 0.5em;
      }
      /* group headings: small engraved caps */
      ::slotted(:is(h1, h2, h3, h4, h5, h6, [data-tr-nav-heading])) {
        margin: 0.9em 0.75em 0.3em;
        font-size: 0.72em;
        font-weight: var(--tr-font-weight-strong, 600);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        opacity: 0.7;
      }
      ::slotted(hr) {
        width: 100%;
        margin: 0.4em 0;
        border: 0;
        border-top: 1px solid color-mix(in oklch, var(--_sh, #000) calc(14% + var(--_r) * 14%), transparent);
        border-bottom: 1px solid color-mix(in oklch, var(--_hl, #fff) calc(var(--_r) * 55%), transparent);
      }
    `,
  ];

  /** Accessible name of the landmark, such as "Main" or "Settings". */
  @property() label = '';

  /** Sidebar (vertical) or top bar (horizontal). */
  @property({ reflect: true }) orientation: Orientation = 'vertical';

  /** Panel surface: raised panel, recessed inset, or none (sits on its container). */
  @property({ reflect: true }) variant: 'panel' | 'inset' | 'flush' = 'panel';

  private has = { header: false, footer: false };

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'navigation');
  }

  protected override render() {
    return html`<div part="panel" class="panel surface">
      <div class="header ${this.has.header ? 'has' : ''}"><slot name="header" @slotchange=${this.onSlot}></slot></div>
      <div part="items" class="items"><slot @slotchange=${this.syncItems}></slot></div>
      <div class="footer ${this.has.footer ? 'has' : ''}"><slot name="footer" @slotchange=${this.onSlot}></slot></div>
    </div>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.label) this.aria('aria-label', this.label);
    if (changed.has('orientation')) this.syncItems();
  }

  private syncItems = (): void => {
    for (const item of this.querySelectorAll('tr-nav-item')) item.dataset.orientation = this.orientation;
  };

  private onSlot(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    this.has[slot.name as 'header' | 'footer'] = slot.assignedNodes({ flatten: true }).some((n) => n.nodeType === 1 || n.textContent?.trim());
    this.requestUpdate();
  }
}

define('tr-nav', TrNav);

declare global {
  interface HTMLElementTagNameMap {
    'tr-nav': TrNav;
  }
}
