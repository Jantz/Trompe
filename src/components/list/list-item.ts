import { hasPainted, insertAnimated, removeAnimated } from '../../interaction/smooth.js';
import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import { PressController } from '../../interaction/press.js';

let nextId = 0;

/**
 * Rows added to lists already on screen, opened into place together once the rows rendered in
 * the same turn have all rendered (still before the next paint). A batch of more than a few rows in one list is a render, not an insertion: it appears
 * at once, without a per-row animation.
 */
const arriving = new Set<TrListItem>();
function queueArrival(row: TrListItem): void {
  if (!arriving.size) {
    queueMicrotask(() => {
      const byList = new Map<Element | null, TrListItem[]>();
      for (const r of arriving) {
        const list = r.closest('tr-list');
        byList.set(list, [...(byList.get(list) ?? []), r]);
      }
      arriving.clear();
      for (const rows of byList.values()) if (rows.length <= 3) for (const r of rows) insertAnimated(r);
    });
  }
  arriving.add(row);
}

/**
 * A row in a tr-list: optional leading icon or avatar, a title with an optional description
 * line, and trailing meta or actions. Rows are separated by engraved divider lines. In a
 * `selectable` list the row is an option: it presses into the tray and shows a check mark when
 * selected. Keep interactive controls out of the `end` slot of selectable lists (an option
 * cannot contain buttons); in plain lists, buttons and switches there are fine.
 *
 * @summary Row of a tr-list (role listitem, or option when the list is selectable).
 * @tag tr-list-item
 *
 * @slot - Title.
 * @slot start - Leading icon, avatar or thumbnail.
 * @slot description - Secondary line under the title.
 * @slot end - Trailing meta text, badge, switch or button.
 *
 * @csspart row - The row layout.
 * @csspart plate - The surface that appears on hover and when selected.
 * @csspart title - Wrapper around the title.
 * @csspart description - Wrapper around the description.
 * @csspart check - The selected check mark.
 *
 * @cssprop --tr-list-item-padding - Row padding. Defaults to 0.7em 0.85em.
 * @cssprop --tr-list-item-gap - Gap between columns. Defaults to 0.85em.
 * @cssprop --tr-list-item-radius - Corner radius of the hover/selected plate. Defaults to --tr-radius-md.
 *
 * @example <tr-list-item><svg slot="start">…</svg>Notifications<span slot="description">Push and email</span><tr-switch slot="end" aria-label="Notifications"></tr-switch></tr-list-item>
 * @example <tr-list-item value="plan" selected>Plan.md<span slot="end">2 KB</span></tr-list-item>
 */
export class TrListItem extends TrompeElement {
  /** Physical press: quick taps stay visible, dragging off cancels, Space holds (see docs/interaction.md). */
  protected readonly pressCtl = new PressController(this, { disabled: () => this.disabled });

  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        display: block;
        position: relative;
        outline: none;
      }
      .row {
        position: relative;
        isolation: isolate;
        display: flex;
        align-items: center;
        gap: var(--tr-list-item-gap, 0.85em);
        min-height: 3em;
        padding: var(--tr-list-item-padding, 0.7em 0.85em);
        border-radius: var(--tr-list-item-radius, var(--tr-radius-md, 10px));
        line-height: 1.3;
      }
      /* engraved divider between rows: a dark cut with the light catching its far lip */
      :host(:not(:first-of-type)) .row::before {
        content: '';
        position: absolute;
        inset: 0 0.85em auto;
        height: 0;
        border-top: 1px solid color-mix(in oklch, var(--_sh) calc(12% + var(--_r) * 14%), transparent);
        border-bottom: 1px solid color-mix(in oklch, var(--_hl) calc(var(--_r) * 50%), transparent);
        translate: 0 -1px;
        transition: opacity var(--tr-motion-duration-release, 160ms);
      }
      :host([role='option'][selected]) .row::before {
        opacity: 0;
      }
      .plate {
        --_tr-z: 0.5;
        /* text sits on this plate: tame reflections */
        --_gloss: calc(var(--tr-f-gloss, var(--tr-m-gloss, 0)) * 0.3);
        --_mirror: calc(var(--tr-f-mirror, var(--tr-m-mirror, 0)) * 0.3);
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        opacity: 0;
        /* --_sel (registered) fades the selected tint in and out with the plate */
        --_sel: 0;
        --_base: color-mix(
          in oklab,
          var(--_m-base),
          color-mix(in oklab, color-mix(in oklab, var(--_m-base), var(--tr-color-accent) 12%), var(--_sh) calc(6% + var(--tr-lift, 0) * 10%))
            calc(var(--_sel) * 100%)
        );
        transition:
          opacity var(--tr-motion-duration-release, 160ms),
          --_sel var(--tr-motion-duration-release, 160ms),
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out);
      }
      :host([role='option']) {
        cursor: pointer;
        user-select: none;
      }
      :host([role='option']:hover:not([disabled])) .plate {
        opacity: 1;
      }
      :host([role='option'][data-tr-pressed]:not([disabled])) .plate {
        --_tr-z: -0.5;
      }
      /* text on the plate takes the plate's own ink (the plate may differ from the list around it) */
      :host([role='option']:hover:not([disabled])) .row,
      :host([role='option'][selected]) .row {
        color: var(--_m-ink);
      }
      :host([role='option'][selected]) .plate {
        --_tr-z: -1;
        --_sel: 1;
        opacity: 1;
      }
      :host(:focus-visible) .row {
        outline: 2px solid var(--tr-color-focus);
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
        outline-offset: -2px;
      }
      ::slotted([slot='start']) {
        flex: none;
      }
      .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.15em;
      }
      .title {
        overflow-wrap: anywhere;
        /* variable fonts thicken smoothly; static fonts switch at the end of the fade */
        transition: font-weight var(--tr-motion-duration-release, 160ms);
      }
      :host([selected]) .title {
        font-weight: var(--tr-font-weight-strong, 600);
      }
      .description {
        font-size: 0.85em;
        opacity: 0.72;
      }
      .description:not(.has) {
        display: none;
      }
      .end {
        flex: none;
        display: flex;
        align-items: center;
        gap: 0.5em;
        font-size: 0.9em;
      }
      .end:not(.has) {
        display: none;
      }
      .check {
        flex: none;
        width: 1.1em;
        height: 1.1em;
        color: var(--tr-color-accent);
        display: none;
        filter: drop-shadow(0 calc(var(--_sy) * 1px) 0 color-mix(in oklch, var(--_hl) calc(var(--_r) * 60%), transparent));
      }
      :host([role='option']) .check {
        display: block;
        opacity: 0;
        scale: 0.6;
        transition:
          opacity var(--tr-motion-duration-release, 160ms),
          scale var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out);
      }
      :host([role='option'][selected]) .check {
        opacity: 1;
        scale: 1;
      }
      :host([disabled]) .row {
        opacity: 0.5;
        cursor: not-allowed;
      }
      @media (pointer: coarse) {
        .row {
          min-height: max(3em, var(--tr-control-touch, 44px));
        }
      }
      @media (forced-colors: active) {
        :host([selected]) .row {
          outline: 2px solid Highlight;
        }
        .check {
          color: Highlight;
        }
      }
    `,
  ];

  /** Value reported by a selectable list. Defaults to the title text. */
  @property({ reflect: true }) value = '';

  /** Whether the row is selected (in a selectable list). */
  @property({ type: Boolean, reflect: true }) selected = false;

  /** Disables the row in a selectable list. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  private has = { description: false, end: false };

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.id) this.id = `tr-list-item-${++nextId}`;
    if (!this.hasAttribute('role')) this.setAttribute('role', 'listitem');
    if (!this.value) this.value = [...this.childNodes].filter((n) => n.nodeType === 3 || !(n as Element).slot).map((n) => n.textContent).join('').trim();
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    // A row added to a list already on screen opens into place instead of pushing rows down.
    if (hasPainted(this.closest('tr-list'))) queueArrival(this);
  }

  /** Removes the row with an exit: it fades while its height closes, so the rows below slide up. */
  dismiss(): Promise<void> {
    return removeAnimated(this);
  }

  protected override render() {
    return html`<div part="row" class="row">
      <span part="plate" class="plate surface"></span>
      <slot name="start"></slot>
      <div class="text">
        <span part="title" class="title"><slot></slot></span>
        <span part="description" class="description ${this.has.description ? 'has' : ''}"><slot name="description" @slotchange=${this.onSlot}></slot></span>
      </div>
      <div class="end ${this.has.end ? 'has' : ''}"><slot name="end" @slotchange=${this.onSlot}></slot></div>
      <svg part="check" class="check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.getAttribute('role') === 'option') {
      this.aria('aria-selected', String(this.selected));
      this.aria('aria-disabled', this.disabled ? 'true' : null);
    }
  }

  private onSlot(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    this.has[slot.name as 'description' | 'end'] = slot.assignedNodes({ flatten: true }).some((n) => n.nodeType === 1 || n.textContent?.trim());
    this.requestUpdate();
  }
}

define('tr-list-item', TrListItem);

declare global {
  interface HTMLElementTagNameMap {
    'tr-list-item': TrListItem;
  }
}
