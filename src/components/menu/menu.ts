import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import { TrMenuItem } from './menu-item.js';
import { afterExit } from '../../interaction/smooth.js';
import { anchorTo, byId, ensureId, placeAt, type Placement } from './position.js';

export type { Placement } from './position.js';

/**
 * A floating command plate opened from a trigger. It sits in the top layer (Popover API) at
 * depth 3, casting a long soft shadow, and its items light up like backlit keys as you move
 * through them. Follows the WAI-ARIA APG menu button pattern: the trigger gets aria-haspopup,
 * aria-expanded and aria-controls; focus moves into the menu and returns to the trigger.
 *
 * The trigger is the element whose id is in `anchor`, or else the menu's previous element sibling.
 * A tr-menu placed in a tr-menu-item's `submenu` slot becomes that item's submenu.
 *
 * @summary Dropdown or context menu of commands, checkbox and radio items (role="menu").
 * @tag tr-menu
 * @role menu
 *
 * @slot - tr-menu-item elements (and separators).
 *
 * @csspart plate - The floating surface.
 *
 * @cssprop --tr-menu-min-width - Minimum width. Defaults to the trigger width or 11em, whichever is larger.
 * @cssprop --tr-menu-max-height - Maximum height before the plate scrolls. Defaults to 70vh.
 * @cssprop --tr-menu-radius - Corner radius of the plate. Defaults to --tr-radius-sm plus the padding, so it is concentric with the items.
 * @cssprop --tr-menu-padding - Inner padding of the plate. Defaults to 0.3em.
 *
 * @fires select - Bubbles up from the activated tr-menu-item. `detail: { value, item, checked }`. Cancel it to keep the menu open.
 * @fires open - The menu opened.
 * @fires close - The menu closed.
 *
 * @example
 * <tr-button>File</tr-button>
 * <tr-menu>
 *   <tr-menu-item value="new" shortcut="Ctrl+N">New</tr-menu-item>
 *   <tr-menu-item value="open">Open…</tr-menu-item>
 *   <tr-menu-item separator></tr-menu-item>
 *   <tr-menu-item type="checkbox" checked>Autosave</tr-menu-item>
 * </tr-menu>
 * @example <tr-menu anchor="view-btn" placement="bottom-end" material="glass">…</tr-menu>
 */
export class TrMenu extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_depth: 3;
        --_curve-default: 0.1;
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--tr-color-ink);
        overflow: visible;
        width: max-content;
        max-width: calc(100vw - 16px);
        font-size: var(--tr-font-size-md, 1em);
        opacity: 0;
        transform: translateY(calc(var(--_sy) * -4px)) scale(0.97);
        transition:
          opacity 120ms ease-in,
          transform 120ms ease-in,
          display 120ms allow-discrete,
          overlay 120ms allow-discrete;
      }
      :host(:popover-open) {
        opacity: 1;
        transform: none;
        transition:
          opacity 160ms ease-out,
          transform var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, cubic-bezier(0.2, 0.9, 0.3, 1.2)),
          display 160ms allow-discrete,
          overlay 160ms allow-discrete;
      }
      @starting-style {
        :host(:popover-open) {
          opacity: 0;
          transform: translateY(calc(var(--_sy) * -6px)) scale(0.96);
        }
      }
      :host(:not([popover])) {
        display: none;
      }
      .plate.surface {
        /* a large plate catches only part of the window reflection */
        --_rg: calc(var(--_r) * (2 - var(--_r)) * 0.4);
      }
      .plate {
        --_tr-z: var(--_depth);
        --_ink: var(--_m-ink);
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: var(--tr-menu-min-width, max(11em, var(--_anchor-w, 0px)));
        max-height: var(--tr-menu-max-height, 70vh);
        overflow: auto;
        overscroll-behavior: contain;
        padding: var(--tr-menu-padding, 0.3em);
        /* concentric with the item keys inside */
        border-radius: var(--tr-menu-radius, calc(var(--tr-radius-sm, 6px) + var(--tr-menu-padding, 0.3em)));
        color: var(--_ink);
      }
      @supports (width: anchor-size(width)) {
        .plate {
          --_anchor-w: anchor-size(width);
        }
      }
      ::slotted(hr),
      ::slotted([role='separator']:not(tr-menu-item)) {
        margin: 0.3em 0.4em;
        border: 0;
        border-top: 1px solid color-mix(in oklch, var(--tr-color-shadow) 30%, transparent);
        border-bottom: 1px solid color-mix(in oklch, var(--tr-color-highlight, #fff) 40%, transparent);
      }
      @media (prefers-reduced-motion: reduce) {
        :host,
        :host(:popover-open) {
          transform: none;
        }
      }
      @media (prefers-reduced-transparency: reduce) {
        .plate {
          background-color: oklch(from var(--_face) l c h / 1);
        }
      }
    `,
  ];

  /** Whether the menu is showing. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Id of the trigger element (in the same document or shadow root). Defaults to the previous element sibling. */
  @property() anchor = '';

  /** Where the menu opens relative to its trigger. It flips automatically when there is no room. Submenus default to right-start. */
  @property({ reflect: true }) placement?: Placement;

  private trigger: HTMLElement | null = null;
  /** ARIA attributes wire() added to the trigger (not ones the author set), removed by unwire(). */
  private addedAria: string[] = [];
  private unplace: (() => void) | null = null;
  private pendingUnplace: (() => void) | null = null;
  private pendingFocus: 'first' | 'last' | 'none' = 'first';
  private point: { x: number; y: number } | null = null;
  private returnFocus = false;
  private wasOpenOnPointerDown = false;
  private typed = '';
  private typedAt = 0;

  constructor() {
    super();
    this.addEventListener('keydown', this.onKeyDown);
    this.addEventListener('click', this.onClick);
    this.addEventListener('pointermove', this.onPointerMove);
    this.addEventListener('beforetoggle', this.onBeforeToggle as EventListener);
  }

  /** The tr-menu-item this menu is a submenu of, if any. */
  get parentItem(): TrMenuItem | null {
    const p = this.parentElement;
    return p instanceof TrMenuItem ? p : null;
  }

  /** The menu's enabled and disabled items, in order, excluding separators and nested menus' items. */
  get items(): TrMenuItem[] {
    return [...this.querySelectorAll('tr-menu-item')].filter(
      (i): i is TrMenuItem => i instanceof TrMenuItem && !i.separator && !i.hidden && i.closest('tr-menu') === this,
    );
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('popover')) this.setAttribute('popover', 'auto');
    this.setAttribute('role', 'menu');
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '-1');
    ensureId(this, 'tr-menu');
    queueMicrotask(() => this.wire());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // The browser hides a removed popover without a toggle event: close properly so the trigger
    // is reset (aria-expanded="false") before it is unwired.
    if (this.open) {
      this.open = false;
      this.finishClose();
    }
    this.unwire();
    this.unplace?.();
    this.unplace = null;
    this.pendingUnplace?.();
  }

  protected override render() {
    return html`<div part="plate" class="plate surface"><slot @slotchange=${this.onSlotChange}></slot></div>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('anchor') && changed.get('anchor') !== undefined) this.wire();
    if (changed.has('open')) this.sync();
  }

  /** Opens the menu next to its trigger and focuses the first item (or the last, or none). */
  show(focus: 'first' | 'last' | 'none' = 'first'): void {
    this.pendingFocus = focus;
    this.point = null;
    if (this.open) {
      this.focusEdge(focus);
      return;
    }
    this.open = true;
    this.sync();
  }

  /** Opens the menu at a viewport point, for context menus. */
  showAt(x: number, y: number, focus: 'first' | 'last' | 'none' = 'first'): void {
    if (this.open) this.close();
    this.pendingFocus = focus;
    this.point = { x, y };
    this.open = true;
    this.sync();
  }

  /** Closes the menu (and its submenus). With `returnFocus`, focus goes back to the trigger. */
  close(options: { returnFocus?: boolean } = {}): void {
    if (!this.open) return;
    this.returnFocus = !!options.returnFocus;
    this.open = false;
    this.sync();
  }

  /** Opens the menu if it is closed, or closes it. */
  toggle(): void {
    if (this.open) this.close({ returnFocus: true });
    else this.show();
  }

  private sync(): void {
    const shown = this.isPopoverOpen();
    if (this.open && !shown) {
      if (!this.isConnected) return;
      if (!this.trigger) this.wire();
      const source = this.trigger ?? undefined;
      try {
        (this.showPopover as (o?: { source?: HTMLElement }) => void)({ source });
      } catch {
        try {
          this.showPopover();
        } catch {
          return;
        }
      }
      this.unplace?.();
      this.unplace = null;
      this.pendingUnplace?.();
      this.pendingUnplace = null;
      if (this.point) placeAt(this, this.point.x, this.point.y);
      else if (this.trigger) {
        this.unplace = anchorTo(this, this.trigger, this.placement ?? (this.parentItem ? 'right-start' : 'bottom-start'), this.parentItem ? 2 : 6);
      }
      this.updateIndent();
      this.setExpanded(true);
      this.focusEdge(this.pendingFocus);
      this.pendingFocus = 'first';
      this.dispatchEvent(new Event('open'));
    } else if (!this.open && shown) {
      // The highlighted item stays lit while the menu fades, though focus has already left it.
      const lit = this.items.find((i) => i.matches(':focus'));
      lit?.setAttribute('data-tr-lit', '');
      try {
        this.hidePopover();
      } catch {
        /* already hidden */
      }
      if (lit) void afterExit(this).then(() => lit.removeAttribute('data-tr-lit'));
      this.finishClose();
    }
  }

  private finishClose(): void {
    // Close open submenus first so their triggers reset.
    for (const item of this.items) {
      const sub = item.submenu as TrMenu | null;
      if (sub?.open) sub.close();
    }
    // Stay where it is while the exit plays; un-anchor once it has faded (or when it reopens).
    const unplace = this.unplace;
    this.unplace = null;
    if (unplace) {
      const pending = (this.pendingUnplace = () => {
        if (this.pendingUnplace === pending) this.pendingUnplace = null;
        unplace();
      });
      void afterExit(this).then(() => this.pendingUnplace === pending && pending());
    }
    this.setExpanded(false);
    const back = this.returnFocus;
    this.returnFocus = false;
    if (back) this.trigger?.focus({ preventScroll: true });
    this.dispatchEvent(new Event('close'));
  }

  private isPopoverOpen(): boolean {
    try {
      return this.matches(':popover-open');
    } catch {
      return false;
    }
  }

  private onBeforeToggle = (e: ToggleEvent): void => {
    if (e.target !== this) return;
    // Light dismiss (outside click, Escape handled by the browser, another popover).
    if (e.newState === 'closed' && this.open) {
      this.open = false;
      queueMicrotask(() => this.finishClose());
    }
  };

  private setExpanded(on: boolean): void {
    const t = this.trigger;
    if (!t) return;
    t.setAttribute('aria-expanded', String(on));
    if (this.parentItem) {
      if (on) t.setAttribute('data-expanded', '');
      else t.removeAttribute('data-expanded');
    }
  }

  private focusEdge(which: 'first' | 'last' | 'none'): void {
    if (which === 'none') {
      this.focus({ preventScroll: true });
      return;
    }
    const items = this.items;
    const item = which === 'first' ? items[0] : items[items.length - 1];
    (item ?? this).focus({ preventScroll: true });
  }

  private updateIndent(): void {
    const items = this.items;
    const any = items.some((i) => i.type !== 'normal');
    for (const i of items) i.setIndent(any);
  }

  private onSlotChange = (): void => {
    if (this.open) this.updateIndent();
  };

  // ---- trigger wiring ----

  private wire(): void {
    this.unwire();
    const parent = this.parentItem;
    const t = parent ?? byId(this, this.anchor) ?? (this.previousElementSibling as HTMLElement | null);
    if (!t) return;
    this.trigger = t;
    if (parent && !this.slot) this.slot = 'submenu';
    const set = (name: string, value: string) => {
      if (!t.hasAttribute(name)) this.addedAria.push(name);
      t.setAttribute(name, value);
    };
    set('aria-haspopup', 'menu');
    set('aria-expanded', String(this.open));
    set('aria-controls', this.id);
    if (!this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) {
      if (parent) this.setAttribute('aria-label', parent.text);
      else this.setAttribute('aria-labelledby', ensureId(t, 'tr-menu-trigger'));
    }
    if (!parent) {
      t.addEventListener('click', this.onTriggerClick);
      t.addEventListener('keydown', this.onTriggerKeyDown);
      t.addEventListener('pointerdown', this.onTriggerPointerDown);
    }
  }

  private unwire(): void {
    const t = this.trigger;
    if (!t) return;
    t.removeEventListener('click', this.onTriggerClick);
    t.removeEventListener('keydown', this.onTriggerKeyDown);
    t.removeEventListener('pointerdown', this.onTriggerPointerDown);
    for (const name of this.addedAria) {
      if (name !== 'aria-controls' || t.getAttribute(name) === this.id) t.removeAttribute(name);
    }
    this.addedAria = [];
    this.trigger = null;
  }

  private onTriggerPointerDown = (): void => {
    this.wasOpenOnPointerDown = this.open;
  };

  private onTriggerClick = (e: MouseEvent): void => {
    const t = this.trigger as (HTMLElement & { disabled?: boolean }) | null;
    if (t?.disabled || t?.getAttribute('aria-disabled') === 'true') return;
    // A pointer press on the trigger may already have light-dismissed the menu.
    const wasOpen = this.open || (e.detail > 0 && this.wasOpenOnPointerDown);
    this.wasOpenOnPointerDown = false;
    if (wasOpen) this.close({ returnFocus: true });
    else this.show('first');
  };

  private onTriggerKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.show(e.key === 'ArrowDown' ? 'first' : 'last');
    }
  };

  // ---- menu keyboard and pointer ----

  private ownItem(target: EventTarget | null): TrMenuItem | null {
    const el = target instanceof Element ? target.closest('tr-menu-item') : null;
    return el instanceof TrMenuItem && el.closest('tr-menu') === this ? el : null;
  }

  private move(from: TrMenuItem | null, delta: number): void {
    const items = this.items;
    if (!items.length) return;
    const i = from ? items.indexOf(from) : -1;
    const next = i < 0 ? (delta > 0 ? 0 : items.length - 1) : (i + delta + items.length) % items.length;
    items[next].focus({ preventScroll: false });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Keys pressed inside a submenu are handled by the submenu.
    const inner = e.composedPath().find((n) => n instanceof TrMenu);
    if (inner && inner !== this) return;
    const item = this.ownItem(e.target);
    const sub = this.parentItem;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    switch (e.key) {
      case 'ArrowDown':
        this.move(item, 1);
        break;
      case 'ArrowUp':
        this.move(item, -1);
        break;
      case 'Home':
      case 'PageUp':
        this.focusEdge('first');
        break;
      case 'End':
      case 'PageDown':
        this.focusEdge('last');
        break;
      case 'Escape':
        e.stopPropagation();
        this.close({ returnFocus: true });
        break;
      case 'Tab':
        // Let focus move on, but close the whole menu chain.
        this.root().close();
        return;
      case 'Enter':
      case ' ':
        if (item) this.activate(item, e.key === ' ' ? 'space' : 'enter');
        break;
      default:
        if (e.key === forward && item?.submenu) {
          (item.submenu as TrMenu).show('first');
          break;
        }
        if (e.key === back && sub) {
          this.close({ returnFocus: true });
          break;
        }
        if (e.key === forward || e.key === back) break;
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          this.typeahead(e.key, item);
          break;
        }
        return;
    }
    e.preventDefault();
  };

  private typeahead(ch: string, from: TrMenuItem | null): void {
    const now = performance.now();
    this.typed = now - this.typedAt > 600 ? ch : this.typed + ch;
    this.typedAt = now;
    const items = this.items;
    const start = from ? items.indexOf(from) : -1;
    const q = this.typed.toLocaleLowerCase();
    // Repeating one letter cycles through items starting with it.
    const cycling = q.length > 1 && [...q].every((c) => c === q[0]);
    const needle = cycling ? q[0] : q;
    const offset = needle.length === 1 ? 1 : 0;
    for (let k = 0; k < items.length; k++) {
      const it = items[(start + offset + k + items.length) % items.length];
      if (it.text.toLocaleLowerCase().startsWith(needle)) {
        it.focus();
        return;
      }
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    const item = this.ownItem(e.target);
    if (item && document.activeElement !== item && !item.matches(':focus')) {
      item.focus({ preventScroll: true });
      // Moving onto a sibling closes another item's open submenu.
      for (const i of this.items) if (i !== item && i.submenu && (i.submenu as TrMenu).open) (i.submenu as TrMenu).close();
      if (item.submenu && !item.disabled) (item.submenu as TrMenu).show('none');
    }
  };

  private onClick = (e: MouseEvent): void => {
    const inner = e.composedPath().find((n) => n instanceof TrMenu);
    if (inner && inner !== this) return;
    const item = this.ownItem(e.target);
    if (item) this.activate(item, 'click');
  };

  private root(): TrMenu {
    let m: TrMenu = this;
    while (m.parentItem) {
      const up = m.parentItem.closest('tr-menu');
      if (!(up instanceof TrMenu)) break;
      m = up;
    }
    return m;
  }

  private activate(item: TrMenuItem, how: 'click' | 'enter' | 'space'): void {
    if (item.disabled) return;
    if (item.submenu) {
      (item.submenu as TrMenu).show('first');
      return;
    }
    if (item.type === 'checkbox') item.checked = !item.checked;
    else if (item.type === 'radio') {
      for (const other of this.radioGroup(item)) other.checked = other === item;
    }
    const ev = new CustomEvent('select', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: { value: item.resolvedValue, item, checked: item.type === 'normal' ? undefined : item.checked },
    });
    item.dispatchEvent(ev);
    const keepOpen = ev.defaultPrevented || (how === 'space' && item.type !== 'normal');
    if (!keepOpen) this.root().close({ returnFocus: true });
  }

  private radioGroup(item: TrMenuItem): TrMenuItem[] {
    const all = [...this.querySelectorAll('tr-menu-item')].filter(
      (i): i is TrMenuItem => i instanceof TrMenuItem && i.closest('tr-menu') === this,
    );
    if (item.name) return all.filter((i) => i.type === 'radio' && i.name === item.name);
    const idx = all.indexOf(item);
    let a = idx;
    let b = idx;
    while (a > 0 && !all[a - 1].separator) a--;
    while (b < all.length - 1 && !all[b + 1].separator) b++;
    return all.slice(a, b + 1).filter((i) => i.type === 'radio' && !i.name);
  }
}

define('tr-menu', TrMenu);

declare global {
  interface HTMLElementTagNameMap {
    'tr-menu': TrMenu;
  }
}
