import { css, html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import { PressController } from '../../interaction/press.js';

/**
 * One destination in a tr-nav. With `href` it renders a real link; without, a button (for
 * client-side routing, listen for `click`). Mark the page you are on with `current`: the item
 * sinks into the panel, gets a lit indicator and bold text, and exposes aria-current="page".
 *
 * Nest tr-nav-items inside one to make a collapsible group: the parent becomes a disclosure
 * button (aria-expanded) and opens by itself when it holds the current page.
 *
 * @summary Navigation link, button or collapsible group inside tr-nav.
 * @tag tr-nav-item
 *
 * @slot - Item label.
 * @slot icon - Icon before the label (16 to 20px SVG).
 * @slot badge - Trailing content such as a tr-badge count.
 * @slot children - Nested tr-nav-items (assigned automatically).
 *
 * @csspart item - The link or button.
 * @csspart plate - The surface behind the item that appears on hover and when current.
 * @csspart indicator - The lit current-page indicator.
 * @csspart label - Wrapper around the label.
 * @csspart group - Wrapper around nested items.
 *
 * @cssprop --tr-nav-item-height - Minimum height. Defaults to 2.4em.
 * @cssprop --tr-nav-item-radius - Corner radius. Defaults to --tr-radius-md.
 * @cssprop --tr-nav-item-indicator - Color of the current-page indicator. Defaults to --tr-color-accent.
 *
 * @fires click - Native click on the link or button.
 * @fires toggle - A group opened or closed. Read `expanded`.
 *
 * @example <tr-nav-item href="/inbox" current><svg slot="icon">…</svg>Inbox<tr-badge slot="badge" tone="accent">12</tr-badge></tr-nav-item>
 * @example <tr-nav-item>Projects<tr-nav-item href="/p/alpha">Alpha</tr-nav-item><tr-nav-item href="/p/beta">Beta</tr-nav-item></tr-nav-item>
 */
export class TrNavItem extends TrompeElement {
  static override shadowRootOptions = { ...TrompeElement.shadowRootOptions, delegatesFocus: true };

  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_ind: var(--tr-nav-item-indicator, var(--tr-color-accent));
        --_rad: var(--tr-nav-item-radius, var(--tr-radius-md, 10px));
        display: block;
      }
      :host([data-orientation='horizontal']) {
        display: inline-block;
      }
      .item {
        position: relative;
        isolation: isolate;
        display: flex;
        align-items: center;
        gap: 0.65em;
        width: 100%;
        min-height: var(--tr-nav-item-height, 2.4em);
        padding: 0 0.75em 0 0.9em;
        border: 0;
        border-radius: var(--_rad);
        background: none;
        color: inherit;
        font: inherit;
        line-height: 1.25;
        text-align: start;
        text-decoration: none;
        cursor: pointer;
        outline: none;
        -webkit-tap-highlight-color: transparent;
        transition: translate var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out);
      }
      .item:focus-visible {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 1px;
      }
      .plate {
        --_tr-z: 0.6;
        /* text sits on this plate: tame reflections */
        --_gloss: calc(var(--tr-f-gloss, var(--tr-m-gloss, 0)) * 0.3);
        --_mirror: calc(var(--tr-f-mirror, var(--tr-m-mirror, 0)) * 0.3);
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        opacity: 0;
        transition:
          opacity var(--tr-motion-duration-release, 160ms),
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out);
      }
      .item:hover .plate {
        opacity: 1;
      }
      :host([data-tr-pressed]) .plate {
        --_tr-z: -0.5;
      }
      :host([current]) .plate {
        --_tr-z: -1;
        --_base: color-mix(in oklch, var(--_m-base), var(--_sh) calc(7% + var(--tr-lift, 0) * 12%));
        opacity: 1;
      }
      /* text on the plate takes the plate's own ink (the plate may differ from the panel around it) */
      .item:hover,
      :host([current]) .item {
        color: var(--_m-ink);
      }
      :host([current]) .item {
        font-weight: var(--tr-font-weight-strong, 600);
        translate: calc(var(--_sx) * 0.5px) calc(var(--_sy) * 0.5px);
      }
      /* a lit LED strip set into the plate's edge */
      .indicator {
        position: absolute;
        inset-inline-start: 0.3em;
        top: 28%;
        bottom: 28%;
        width: 0.2em;
        border-radius: 1em;
        background: var(--_ind);
        box-shadow:
          0 0 calc(var(--_r) * 6px) color-mix(in oklch, var(--_ind) calc(var(--_r) * 70%), transparent),
          inset 0 1px 0 color-mix(in oklch, white calc(var(--_r) * 50%), transparent);
        opacity: 0;
        scale: 1 0.3;
        transition:
          opacity var(--tr-motion-duration-release, 160ms),
          scale var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out);
      }
      :host([current]) .indicator {
        opacity: 1;
        scale: 1 1;
      }
      :host([data-orientation='horizontal']) .item {
        padding: 0 0.85em;
      }
      :host([data-orientation='horizontal']) .indicator {
        inset: auto 28% 0.25em;
        width: auto;
        height: 0.2em;
        scale: 0.3 1;
      }
      :host([data-orientation='horizontal'][current]) .indicator {
        scale: 1 1;
      }
      .label {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      ::slotted([slot='icon']) {
        flex: none;
        width: 1.15em;
        height: 1.15em;
        opacity: 0.85;
      }
      :host([current]) ::slotted([slot='icon']) {
        opacity: 1;
        color: var(--_ind);
      }
      .chevron {
        flex: none;
        width: 0.7em;
        height: 0.7em;
        opacity: 0.7;
        transition: rotate var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out);
      }
      :host([expanded]) .chevron {
        rotate: 90deg;
      }
      .group {
        margin-inline-start: 1.35em;
        padding: 0.15em 0 0.15em 0.5em;
        display: flex;
        flex-direction: column;
        gap: 0.1em;
        /* engraved guide line */
        border-inline-start: 1px solid color-mix(in oklch, var(--_sh) calc(14% + var(--_r) * 14%), transparent);
        box-shadow: inset 1px 0 0 color-mix(in oklch, var(--_hl) calc(var(--_r) * 55%), transparent);
      }
      .group[hidden] {
        display: none;
      }
      :host([disabled]) .item {
        opacity: 0.5;
        cursor: not-allowed;
      }
      @media (pointer: coarse) {
        .item {
          min-height: max(var(--tr-nav-item-height, 2.4em), var(--tr-control-touch, 44px));
        }
      }
      @media (forced-colors: active) {
        :host([current]) .item {
          outline: 2px solid Highlight;
        }
        .indicator {
          background: Highlight;
          forced-color-adjust: none;
        }
      }
    `,
  ];

  /** Physical press: quick taps stay visible, dragging off cancels, Space holds (see docs/interaction.md). */
  protected readonly pressCtl = new PressController(this, { disabled: () => this.disabled });


  /** Destination URL. Without it the item renders a button. */
  @property({ reflect: true }) href?: string;

  /** Link target, such as _blank. */
  @property() target?: string;

  /** Link rel, such as noopener. */
  @property() rel?: string;

  /** Marks the current page (aria-current="page"). */
  @property({ type: Boolean, reflect: true }) current = false;

  /** Whether a group's nested items are shown. */
  @property({ type: Boolean, reflect: true }) expanded = false;

  /** Disables the item (only applies when it renders a button). */
  @property({ type: Boolean, reflect: true }) disabled = false;

  private hasChildren = false;

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.parentElement?.localName === 'tr-nav-item' && !this.hasAttribute('slot')) this.setAttribute('slot', 'children');
    const nav = this.closest('tr-nav');
    if (nav) this.dataset.orientation = nav.getAttribute('orientation') ?? 'vertical';
  }

  protected override render() {
    const content = html`<span part="plate" class="plate surface"></span>
      <span part="indicator" class="indicator" aria-hidden="true"></span>
      <slot name="icon"></slot>
      <span part="label" class="label"><slot></slot></span>
      <slot name="badge"></slot>
      ${this.hasChildren
        ? html`<svg class="chevron" viewBox="0 0 10 10" aria-hidden="true"><path d="M3.5 1.5 7 5l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
        : nothing}`;
    const item =
      this.href != null && !this.hasChildren
        ? this.disabled
          ? // A disabled link keeps its role and name but cannot be focused or followed.
            html`<a part="item" class="item" role="link" aria-disabled="true" aria-current=${this.current ? 'page' : nothing}>${content}</a>`
          : html`<a part="item" class="item" href=${this.href} target=${ifDefined(this.target)} rel=${ifDefined(this.rel)} aria-current=${this.current ? 'page' : nothing}>${content}</a>`
        : html`<button
            part="item"
            class="item"
            type="button"
            ?disabled=${this.disabled}
            aria-current=${this.current ? 'page' : nothing}
            aria-expanded=${this.hasChildren ? String(this.expanded) : nothing}
            aria-controls=${this.hasChildren ? 'group' : nothing}
            @click=${this.onToggle}
          >
            ${content}
          </button>`;
    return html`${item}
      <div part="group" id="group" class="group" role="group" ?hidden=${!this.hasChildren || !this.expanded}>
        <slot name="children" @slotchange=${this.onChildren}></slot>
      </div>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('expanded') && changed.get('expanded') !== undefined) {
      this.dispatchEvent(new Event('toggle', { bubbles: true, composed: true }));
    }
  }

  private onChildren(e: Event): void {
    const els = (e.target as HTMLSlotElement).assignedElements();
    this.hasChildren = els.length > 0;
    if (els.some((el) => el.hasAttribute('current') || el.querySelector('[current]'))) this.expanded = true;
    this.requestUpdate();
  }

  private onToggle(): void {
    if (this.hasChildren) this.expanded = !this.expanded;
  }
}

define('tr-nav-item', TrNavItem);

declare global {
  interface HTMLElementTagNameMap {
    'tr-nav-item': TrNavItem;
  }
}
