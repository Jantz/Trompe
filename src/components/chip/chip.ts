import { css, html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import { PressController } from '../../interaction/press.js';
import { SizeTransition, crossfadeText } from '../../interaction/smooth.js';
// Importing a chip defines its group too (and the group imports the chip).
import './chip-group.js';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A small pill-shaped key: a filter, a time slot, a tag. Three uses:
 *
 * - **In a `tr-chip-group`** the chips are choices: one at a time (radio semantics), or any number
 *   with `multiple` (checkbox semantics). The group is the form field.
 * - **On its own** a chip is a toggle (a filter such as "Open now"): `selected` flips on click,
 *   Space or Enter, and it fires `change`.
 * - **`removable`** makes it a tag with a small × key. Pressing it (or Backspace / Delete on it)
 *   fires a cancelable `remove`; unless you cancel it, the chip fades and shrinks away, the chips
 *   after it glide into its place, and it fires `removed` once it is gone (hidden). Drop the item
 *   from your data on `removed`.
 *
 * A selectable chip carries a small socket at its start: choosing the chip presses it into the
 * surface, lights the socket and draws a check in it. The socket is always there, so choosing
 * never changes the chip's width and nothing around it moves.
 *
 * @summary Pill-shaped choice, filter toggle or removable tag; use several in tr-chip-group.
 * @tag tr-chip
 * @role button
 *
 * @slot - The label. Also the start of the accessible name.
 * @slot start - An icon (`tr-icon`) or a small avatar.
 *
 * @csspart chip - The pill.
 * @csspart indicator - The socket with the check (selectable chips).
 * @csspart label - Wrapper around the label.
 * @csspart count - The count.
 * @csspart remove - The × key of a removable chip.
 *
 * @cssprop --tr-chip-accent - Colour of the lit socket and the chosen rim. Defaults to --tr-color-accent.
 * @cssprop --tr-chip-radius - Corner radius. Defaults to a pill.
 *
 * @fires change - A standalone chip was toggled by the user.
 * @fires remove - The × key (or Backspace / Delete) was pressed on a removable chip. Cancelable: preventDefault keeps the chip.
 * @fires removed - A removable chip finished animating out and is hidden. Remove its item from your data now.
 *
 * @example <tr-chip-group label="Time" name="slot" value="09:30"><tr-chip>09:00</tr-chip><tr-chip>09:30</tr-chip><tr-chip disabled>10:00</tr-chip><tr-chip>10:30</tr-chip></tr-chip-group>
 * @example <tr-chip selected><tr-icon slot="start" name="clock"></tr-icon>Open now</tr-chip>
 * @example <tr-chip removable>Design</tr-chip> <tr-chip removable>Bug</tr-chip> <tr-chip removable count="3">Docs</tr-chip>
 */
export class TrChip extends TrompeElement {
  /** Physical press: quick taps stay visible, dragging off cancels, Space holds (see docs/interaction.md). */
  protected readonly pressCtl = new PressController(this, { disabled: () => this.disabled || this.groupDisabled || this.removable });

  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_acc: var(--tr-chip-accent, var(--tr-color-accent));
        --_h: 2.125em;
        display: inline-flex;
        vertical-align: middle;
        position: relative;
        max-width: 100%;
        min-width: 0;
        font-size: var(--tr-font-size-sm, 0.875em);
        line-height: 1.2;
        cursor: pointer;
        user-select: none;
        outline: none;
        touch-action: manipulation;
      }
      :host([size='sm']) {
        --_h: 1.85em;
        font-size: var(--tr-font-size-xs, 0.8125em);
      }
      :host([size='lg']) {
        --_h: 2.5em;
        font-size: var(--tr-font-size-md, 1em);
      }
      :host([removable]) {
        cursor: default;
      }
      :host([hidden]) {
        display: none;
      }
      .chip {
        --_tr-z: 1;
        --_gloss: calc(var(--tr-f-gloss, var(--tr-m-gloss, 0)) * 0.45);
        --_mirror: calc(var(--tr-f-mirror, var(--tr-m-mirror, 0)) * 0.3);
        --_reflect: 0.5;
        --_sel: 0;
        --_base: color-mix(in oklab, var(--_m-base), color-mix(in oklab, var(--_m-base), var(--_acc) 12%) calc(var(--_sel) * 100%));
        display: inline-flex;
        align-items: center;
        gap: 0.45em;
        min-width: 0;
        max-width: 100%;
        min-height: var(--_h);
        padding: 0 0.85em;
        border-radius: var(--tr-chip-radius, var(--tr-radius-pill, 999px));
        font-weight: var(--tr-font-weight-strong, 600);
        white-space: nowrap;
        transition:
          --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out),
          --_sel var(--tr-motion-duration-release, 160ms) ease-out,
          border-color var(--tr-motion-duration-release, 160ms) ease-out,
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          translate var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out);
      }
      .chip.has-socket {
        padding-inline-start: 0.4em;
      }
      .chip.has-start:not(.has-socket) {
        padding-inline-start: 0.5em;
      }
      .chip.has-remove {
        padding-inline-end: 0.2em;
      }
      /* the accent rim of a chosen chip: drawn over the edge, so the border never changes width */
      .chip::after {
        content: '';
        position: absolute;
        inset: -1px;
        border-radius: inherit;
        border: 1.5px solid var(--_acc);
        box-shadow: 0 0 calc(3px + var(--_r) * 8px) color-mix(in oklch, var(--_acc) calc(var(--_r) * 28%), transparent);
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--tr-motion-duration-release, 160ms) ease-out;
      }
      :host(:not([removable]):hover) .chip {
        --_tr-z: 1.7;
      }
      :host([data-tr-pressed]) .chip {
        --_tr-z: 0.2;
        transition-duration: var(--tr-motion-duration-press, 70ms);
      }
      :host([selected]) .chip {
        --_tr-z: -0.6;
        --_sel: 1;
        translate: calc(var(--_sx) * 0.4px) calc(var(--_sy) * 0.4px);
      }
      :host([selected][data-tr-pressed]) .chip {
        --_tr-z: -1;
      }
      :host([selected]) .chip::after {
        opacity: 1;
      }
      :host(:focus-visible) .chip {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 2px;
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
      }

      .start {
        display: inline-flex;
        align-items: center;
        flex: none;
      }
      ::slotted([slot='start']) {
        flex: none;
        max-height: calc(var(--_h) - 0.6em);
      }
      .label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .count {
        flex: none;
        display: inline-block;
        padding: 0.1em 0.4em;
        border-radius: 999px;
        font-size: 0.85em;
        font-weight: var(--tr-font-weight-strong, 600);
        font-variant-numeric: tabular-nums;
        text-align: center;
        background: color-mix(in oklch, currentColor 10%, transparent);
        color: color-mix(in oklch, currentColor 80%, transparent);
      }
      /* a count going from 9 to 12 widens its pill smoothly instead of in one frame */
      .count-box {
        display: inline-flex;
        justify-content: center;
        /* room for two digits, so most counts change without the pill changing size */
        min-width: 2.4ch;
      }
      .count-text {
        white-space: nowrap;
      }
      [hidden] {
        display: none !important;
      }

      /* ---- socket: a small well that lights and takes a check when the chip is chosen ---- */
      .socket {
        --_tr-z: -1;
        --_base: var(--tr-color-well);
        --_edge: var(--_edge-strong);
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        --_tex: none;
        flex: none;
        position: relative;
        width: 1.3em;
        height: 1.3em;
        border-radius: 50%;
      }
      .socket::after {
        content: '';
        position: absolute;
        inset: -40%;
        border-radius: 50%;
        background: radial-gradient(closest-side, color-mix(in oklch, var(--_acc) calc(var(--_r) * 45%), transparent), transparent);
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--tr-motion-duration-travel, 220ms);
      }
      .bead {
        --_tr-z: 1;
        --_base: var(--_acc);
        --_curve: 0.9;
        --_brush: 0;
        --_spin: 0;
        --_tex: none;
        --_gloss: max(var(--tr-f-gloss, var(--tr-m-gloss, 0)), 0.5);
        position: absolute;
        inset: 10%;
        border-radius: 50%;
        border-color: color-mix(in oklch, var(--_acc), var(--_sh) 30%);
        opacity: 0;
        scale: 0.3;
        transition:
          opacity var(--tr-motion-duration-press, 70ms),
          scale var(--tr-motion-duration-return, 354ms) var(--tr-motion-easing-return, ease-out);
      }
      .check {
        position: absolute;
        inset: 14%;
        width: 72%;
        height: 72%;
        fill: none;
        stroke: var(--tr-color-accent-ink, #fff);
        stroke-width: 2.6;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 14;
        stroke-dashoffset: 14;
        transition: stroke-dashoffset var(--tr-motion-duration-travel, 220ms) ease-out 40ms;
      }
      :host([selected]) .socket::after {
        opacity: 1;
      }
      :host([selected]) .bead {
        opacity: 1;
        scale: 1;
      }
      :host([selected]) .check {
        stroke-dashoffset: 0;
      }

      /* ---- the × key of a removable chip ---- */
      .remove {
        all: unset;
        flex: none;
        position: relative;
        display: inline-grid;
        place-items: center;
        width: calc(var(--_h) - 0.45em);
        height: calc(var(--_h) - 0.45em);
        border-radius: 50%;
        cursor: pointer;
        color: color-mix(in oklch, currentColor 70%, transparent);
        transition: color var(--tr-motion-duration-release, 160ms) ease-out;
      }
      /* the key sinks into a small well on hover; the well fades in, it does not pop */
      .remove::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: color-mix(in oklch, var(--_sh) calc(10% + var(--_r) * 6%), transparent);
        box-shadow:
          inset calc(var(--_sx) * 0.6px) calc(var(--_sy) * 0.6px) calc(1px + var(--_r) * 1.5px) color-mix(in oklch, var(--_sh) calc(var(--_r) * 40%), transparent),
          inset calc(var(--_sx) * -0.5px) calc(var(--_sy) * -0.5px) 0 color-mix(in oklab, var(--_hl) calc(var(--_r) * 30%), transparent);
        opacity: 0;
        scale: 0.7;
        transition:
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          scale var(--tr-motion-duration-release, 160ms) ease-out;
      }
      /* a touch target of at least 24px around the small key */
      .remove::after {
        content: '';
        position: absolute;
        inset: max(-0.3em, calc((100% - 24px) / 2 * -1));
        min-width: 24px;
        min-height: 24px;
      }
      .remove:hover,
      .remove:focus-visible {
        color: currentColor;
      }
      .remove:hover::before,
      .remove:focus-visible::before,
      .remove.pressed::before {
        opacity: 1;
        scale: 1;
      }
      .remove.pressed::before {
        background: color-mix(in oklch, var(--_sh) calc(18% + var(--_r) * 8%), transparent);
      }
      .remove:focus-visible {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 1px;
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      .remove svg {
        position: relative;
        width: 0.8em;
        height: 0.8em;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        fill: none;
      }

      :host([disabled]),
      :host([data-group-disabled]) {
        cursor: not-allowed;
      }
      :host([disabled]) .chip,
      :host([data-group-disabled]) .chip {
        opacity: 0.5;
        --_tr-z: 0.4;
      }
      @media (pointer: coarse) {
        .chip {
          min-height: max(var(--_h), 2.25rem);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        :host([selected]) .chip {
          translate: none;
        }
      }
      @media (forced-colors: active) {
        .chip {
          border: 1px solid ButtonText;
        }
        :host([selected]) .chip::after {
          border-color: Highlight;
          forced-color-adjust: none;
        }
        .socket {
          border-color: ButtonText;
          background: Field;
        }
        .bead {
          background: Highlight;
          forced-color-adjust: none;
        }
        .remove:focus-visible {
          outline-color: Highlight;
        }
      }
    `,
  ];

  /** Value the group takes when this chip is chosen. Defaults to the label text. */
  @property({ reflect: true }) value = '';

  /** Whether this chip is chosen (or, on its own, switched on). Managed by a group when in one. */
  @property({ type: Boolean, reflect: true }) selected = false;

  /** Makes this chip unavailable. Arrow keys in a group skip it. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Shows a × key that removes the chip (a tag or an entered value). Removable chips are not selectable. */
  @property({ type: Boolean, reflect: true }) removable = false;

  /** A number shown after the label, such as how many results a filter has. Changes cross-fade. */
  @property({ reflect: true }) count = '';

  /** Chip size. */
  @property({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'md';

  /** Set by the group when the whole group is disabled. */
  @state() groupDisabled = false;

  /** The count's pill glides to its new width. */
  protected readonly countSize = new SizeTransition(
    this,
    () => ({ outer: this.renderRoot?.querySelector<HTMLElement>('.count-box'), inner: this.renderRoot?.querySelector<HTMLElement>('.count-text') }),
    { axis: 'inline' },
  );

  @state() private hasStart = false;
  @state() private inGroup = false;
  @state() private pressedX = false;
  private removing = false;

  constructor() {
    super();
    this.addEventListener('click', this.onHostClick);
    this.addEventListener('keydown', this.onHostKeyDown);
  }

  /** The value used by the group: `value`, or the label text. */
  get chipValue(): string {
    if (this.value) return this.value;
    return this.labelText;
  }

  /** The label text, without the start slot. */
  get labelText(): string {
    return [...this.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE || (n instanceof Element && !n.hasAttribute('slot')))
      .map((n) => n.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.inGroup = !!this.closest('tr-chip-group');
    this.syncRole();
  }

  /**
   * Removes the chip as the × key does: fires a cancelable `remove`, then (unless cancelled) fades
   * and shrinks it away while the chips after it glide into its place, hides it and fires `removed`.
   * Resolves true when the chip was removed.
   */
  async removeChip(): Promise<boolean> {
    if (this.removing || this.disabled || this.groupDisabled) return false;
    const go = this.dispatchEvent(new CustomEvent('remove', { bubbles: true, composed: true, cancelable: true }));
    if (!go) return false;
    this.removing = true;
    const hadFocus = this.matches(':focus-within');
    const parent = this.parentElement;
    const siblings = parent ? [...parent.children].filter((c): c is HTMLElement => c !== this && c instanceof HTMLElement) : [];
    const chip = this.renderRoot.querySelector<HTMLElement>('.chip');
    this.style.pointerEvents = 'none';
    if (chip && !reduced()) {
      await chip
        .animate([{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.82' }], { duration: 160, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' })
        .finished.catch(() => {});
    }
    // Hide in place, then let the neighbours glide from where they were to where they are now.
    const before = siblings.map((s) => s.getBoundingClientRect());
    let next: TrChip | undefined;
    if (hadFocus) {
      const chips = siblings.filter((s): s is TrChip => s instanceof TrChip && !s.hidden && !s.disabled);
      const all = parent ? [...parent.children] : [];
      const i = all.indexOf(this);
      next = chips.find((c) => all.indexOf(c) > i) ?? [...chips].reverse().find((c) => all.indexOf(c) < i);
    }
    this.hidden = true;
    this.style.pointerEvents = '';
    if (!reduced()) {
      siblings.forEach((s, k) => {
        const a = before[k]!;
        const b = s.getBoundingClientRect();
        const dx = a.left - b.left;
        const dy = a.top - b.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        s.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      });
    }
    chip?.getAnimations().forEach((a) => a.cancel());
    if (next) next.focusRemove();
    else if (hadFocus) (this.closest('tr-chip-group') as HTMLElement | null)?.focus();
    this.removing = false;
    this.dispatchEvent(new CustomEvent('removed', { bubbles: true, composed: true }));
    return true;
  }

  /** Focuses the × key of a removable chip, or the chip itself. */
  focusRemove(): void {
    const x = this.renderRoot.querySelector<HTMLButtonElement>('.remove');
    if (x) x.focus();
    else this.focus();
  }

  override focus(options?: FocusOptions): void {
    if (this.removable) this.renderRoot.querySelector<HTMLButtonElement>('.remove')?.focus(options);
    else super.focus(options);
  }

  protected override render() {
    const selectable = !this.removable;
    const label = this.labelText;
    return html`<span
      part="chip"
      class="chip surface ${selectable && this.inGroup ? 'has-socket' : ''} ${this.hasStart ? 'has-start' : ''} ${this.removable ? 'has-remove' : ''}"
    >
      ${selectable && this.inGroup
        ? html`<span part="indicator" class="socket surface" aria-hidden="true"
            ><span class="bead surface"></span
            ><svg class="check" viewBox="0 0 16 16"><path d="M3.8 8.4l2.8 2.8 5.6-6.3" /></svg
          ></span>`
        : nothing}
      <span class="start" ?hidden=${!this.hasStart}><slot name="start" @slotchange=${this.onStartSlot}></slot></span>
      <span part="label" class="label"><slot @slotchange=${() => this.requestUpdate()}></slot></span>
      <span part="count" class="count" ?hidden=${!this.count}
        ><span class="count-box"><span class="count-text">${this.count}</span></span></span
      >
      ${this.removable
        ? html`<button
            part="remove"
            class="remove ${this.pressedX ? 'pressed' : ''}"
            type="button"
            aria-label=${`Remove ${label}`}
            ?disabled=${this.disabled || this.groupDisabled}
            @click=${this.onRemoveClick}
            @keydown=${this.onRemoveKey}
            @pointerdown=${() => (this.pressedX = true)}
            @pointerup=${() => (this.pressedX = false)}
            @pointerleave=${() => (this.pressedX = false)}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
          </button>`
        : nothing}
    </span>`;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('removable')) this.syncRole();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const off = this.disabled || this.groupDisabled;
    if (this.removable) {
      this.aria('aria-checked', null);
      this.aria('aria-pressed', null);
      this.aria('aria-disabled', null);
      if (this.getAttribute('tabindex') !== null && !this.inGroup) this.removeAttribute('tabindex');
    } else if (this.inGroup) {
      this.aria('aria-pressed', null);
      this.aria('aria-checked', String(this.selected));
      this.aria('aria-disabled', off ? 'true' : null);
    } else {
      this.aria('aria-checked', null);
      this.aria('aria-pressed', String(this.selected));
      this.aria('aria-disabled', off ? 'true' : null);
      const t = off ? '-1' : '0';
      if (this.getAttribute('tabindex') !== t) this.setAttribute('tabindex', t);
    }
    this.toggleAttribute('data-group-disabled', this.groupDisabled);
    const prev = changed.get('count') as string | undefined;
    if (prev && this.count && prev !== this.count) crossfadeText(this.renderRoot.querySelector<HTMLElement>('.count-text'), prev, { duration: 160 });
  }

  private syncRole(): void {
    if (this.removable) {
      // A tag: plain text plus its own × button. The host is not a control.
      if (this.getAttribute('role') !== 'listitem' && this.parentElement?.getAttribute('role') === 'list') this.setAttribute('role', 'listitem');
      else if (this.getAttribute('role') && this.getAttribute('role') !== 'listitem') this.removeAttribute('role');
      return;
    }
    const group = this.closest('tr-chip-group');
    const role = group ? (group.hasAttribute('multiple') ? 'checkbox' : 'radio') : 'button';
    if (this.getAttribute('role') !== role) this.setAttribute('role', role);
  }

  private onStartSlot(e: Event): void {
    const slot = e.target as HTMLSlotElement;
    this.hasStart = slot.assignedNodes({ flatten: true }).some((n) => n.nodeType === 1 || n.textContent?.trim());
  }

  private onRemoveClick = (e: MouseEvent): void => {
    e.stopPropagation();
    this.pressedX = false;
    void this.removeChip();
  };

  private onRemoveKey = (e: KeyboardEvent): void => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      void this.removeChip();
    }
  };

  /** A standalone (not grouped, not removable) chip is a toggle. */
  private onHostClick = (e: MouseEvent): void => {
    if (this.inGroup || this.removable) return;
    if (this.disabled) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    this.selected = !this.selected;
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  };

  private onHostKeyDown = (e: KeyboardEvent): void => {
    if (this.inGroup || this.removable || e.target !== this) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) this.click();
    }
  };
}

define('tr-chip', TrChip);

declare global {
  interface HTMLElementTagNameMap {
    'tr-chip': TrChip;
  }
}
