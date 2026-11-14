import { css, html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import { afterExit } from '../../interaction/smooth.js';

const ICONS = {
  neutral: html`<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M8 7.2v4M8 4.6v.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>`,
  accent: html`<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M8 7.2v4M8 4.6v.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>`,
  success: html`<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M5.2 8.3l2 2 3.8-4.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>`,
  warning: html`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2l6.2 11H1.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /><path d="M8 6.6v3.2M8 11.6v.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>`,
  danger: html`<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M5.8 5.8l4.4 4.4m0-4.4l-4.4 4.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>`,
};

export type ToastTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

/**
 * A short notice that something happened: "Saved", "Message sent", "Couldn't connect". A floating
 * plate with a lit tone lamp, the message, an optional action and a close key. It slides and
 * fades in, waits `duration` ms (paused while hovered or focused), then slides out.
 *
 * Usually you don't place it yourself: call `toast('Saved', { tone: 'success' })` (exported from
 * `trompe`), which stacks toasts in a `tr-toaster` on top of everything, so nothing on the page
 * moves. Placed in your own markup, toggle `open`; reserve its space if it sits in the flow.
 *
 * It is a live region: role="status" (polite), or role="alert" for `tone="danger"`.
 *
 * @summary Toast / snackbar notice with a tone lamp, action and auto-dismiss.
 * @tag tr-toast
 * @role status
 *
 * @slot - The message.
 * @slot icon - Replaces the tone icon.
 * @slot action - A button, e.g. `<tr-button slot="action" size="sm">Undo</tr-button>`.
 *
 * @csspart toast - The plate.
 * @csspart lamp - The tone lamp and icon.
 * @csspart message - Wrapper around the message.
 * @csspart close-button - The close key (with `dismissible`).
 *
 * @cssprop --tr-toast-width - Width. Defaults to min(26em, 100vw - 2em).
 * @cssprop --tr-toast-color - Tone colour of the lamp. Defaults by `tone`.
 *
 * @fires close - The toast closed (timeout, close key, Escape or `hide()`). `detail.reason` says which.
 *
 * @example <tr-toast open tone="success">Changes saved.</tr-toast>
 * @example <tr-toast open tone="danger" dismissible>Couldn't reach the server.<tr-button slot="action" size="sm">Retry</tr-button></tr-toast>
 */
export class TrToast extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_tone: var(--tr-toast-color, var(--tr-color-ink-muted));
        display: block;
        width: var(--tr-toast-width, min(26em, 100vw - 2em));
        max-width: 100%;
        font-size: var(--tr-font-size-md, 1em);
        pointer-events: auto;
        transition:
          opacity var(--tr-motion-duration-lift, 240ms) ease-out,
          translate var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, cubic-bezier(0.2, 0.7, 0.2, 1)),
          scale var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, cubic-bezier(0.2, 0.7, 0.2, 1)),
          display var(--tr-motion-duration-lift, 240ms) allow-discrete;
      }
      :host(:not([open])) {
        display: none;
        opacity: 0;
        translate: 0 var(--_from, 0.75em);
        scale: 0.96;
        transition-timing-function: ease-in;
      }
      @starting-style {
        :host([open]) {
          opacity: 0;
          translate: 0 var(--_from, 0.75em);
          scale: 0.96;
        }
      }
      :host([tone='accent']) { --_tone: var(--tr-toast-color, var(--tr-color-accent)); }
      :host([tone='success']) { --_tone: var(--tr-toast-color, var(--tr-color-success, oklch(62% 0.15 150))); }
      :host([tone='warning']) { --_tone: var(--tr-toast-color, var(--tr-color-warning, oklch(78% 0.15 80))); }
      :host([tone='danger']) { --_tone: var(--tr-toast-color, var(--tr-color-danger)); }
      .toast {
        --_tr-z: 3;
        --_reflect: 0.4;
        display: flex;
        align-items: center;
        gap: 0.75em;
        min-height: 3em;
        padding: 0.6em 0.6em 0.6em 0.75em;
        border-radius: var(--tr-radius-lg, 14px);
        line-height: 1.35;
      }
      .lamp {
        flex: none;
        display: grid;
        place-items: center;
        width: 1.75em;
        height: 1.75em;
        border-radius: 50%;
        color: var(--_tone);
        background: radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--_tone) calc(10% + var(--_r) * 12%), transparent), transparent 70%);
      }
      .lamp svg,
      ::slotted([slot='icon']) {
        width: 1.25em;
        height: 1.25em;
        filter: drop-shadow(0 0 calc(var(--_r) * 3px) color-mix(in oklch, var(--_tone) 60%, transparent));
      }
      .message {
        flex: 1;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .actions {
        flex: none;
        display: flex;
        align-items: center;
        gap: 0.25em;
      }
      .close {
        display: grid;
        place-items: center;
        width: 2em;
        height: 2em;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--tr-color-ink-muted);
        font: inherit;
        cursor: pointer;
        transition: background-color var(--tr-motion-duration-release, 160ms);
      }
      .close:hover {
        background: color-mix(in oklch, currentColor 14%, transparent);
      }
      .close:focus-visible {
        outline: 2px solid var(--tr-color-focus);
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
        outline-offset: 1px;
      }
      .close svg {
        width: 0.9em;
        height: 0.9em;
      }
      @media (pointer: coarse) {
        .close {
          width: 2.75em;
          height: 2.75em;
        }
      }
      @media (forced-colors: active) {
        .toast {
          border: 1px solid CanvasText;
        }
      }
    `,
  ];

  /** Meaning of the notice. Pair it with words that say the same. */
  @property({ reflect: true }) tone: ToastTone = 'neutral';

  /** Shows the toast. Removing it (or `hide()`) slides it out. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Milliseconds before it closes itself; 0 keeps it until closed. Paused while hovered or focused. */
  @property({ type: Number, reflect: true }) duration = 0;

  /** Shows a close key. */
  @property({ type: Boolean, reflect: true }) dismissible = false;

  private timer?: ReturnType<typeof setTimeout>;
  private remaining = 0;
  private startedAt = 0;
  private paused = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncRole();
    this.addEventListener('pointerenter', this.pause);
    this.addEventListener('pointerleave', this.resume);
    this.addEventListener('focusin', this.pause);
    this.addEventListener('focusout', this.resume);
    this.addEventListener('keydown', this.onKey);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.timer);
  }

  /** Opens it (and restarts the timer). */
  show(): void {
    this.open = true;
  }

  /** Closes it; fires `close`. */
  hide(reason: 'timeout' | 'dismiss' | 'escape' | 'api' = 'api'): void {
    if (!this.open) return;
    clearTimeout(this.timer);
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true, detail: { reason } }));
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('tone')) this.syncRole();
    if ((changed.has('open') || changed.has('duration')) && this.open) {
      this.remaining = this.duration;
      this.startTimer();
    }
  }

  private syncRole(): void {
    this.setAttribute('role', this.tone === 'danger' ? 'alert' : 'status');
    if (!this.hasAttribute('aria-live')) this.setAttribute('aria-live', this.tone === 'danger' ? 'assertive' : 'polite');
  }

  private startTimer(): void {
    clearTimeout(this.timer);
    if (!this.open || this.remaining <= 0 || this.paused) return;
    this.startedAt = performance.now();
    this.timer = setTimeout(() => this.hide('timeout'), this.remaining);
  }

  private pause = (): void => {
    if (this.paused) return;
    this.paused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.remaining = Math.max(1200, this.remaining - (performance.now() - this.startedAt));
    }
  };

  private resume = (e: Event): void => {
    if (e.type === 'focusout' && this.contains((e as FocusEvent).relatedTarget as Node)) return;
    this.paused = false;
    this.startTimer();
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && (this.dismissible || this.duration > 0)) this.hide('escape');
  };

  protected override render() {
    return html`<div part="toast" class="toast surface">
      <span part="lamp" class="lamp"><slot name="icon">${ICONS[this.tone] ?? ICONS.neutral}</slot></span>
      <span part="message" class="message"><slot></slot></span>
      <span class="actions">
        <slot name="action"></slot>
        ${this.dismissible
          ? html`<button part="close-button" class="close" type="button" aria-label="Dismiss" @click=${() => this.hide('dismiss')}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8m0-8l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
            </button>`
          : nothing}
      </span>
    </div>`;
  }
}

/**
 * The stack that `toast()` fills: fixed over the page in the top layer (above open dialogs), so a
 * toast never pushes content. New toasts slide in; when one leaves, the others glide into its
 * place. One is created on first use; add your own to choose `placement`.
 *
 * @summary Fixed stack for toasts (used by the `toast()` helper).
 * @tag tr-toaster
 *
 * @slot - tr-toast elements.
 *
 * @cssprop --tr-toaster-gap - Space between toasts. Defaults to 0.5em.
 * @cssprop --tr-toaster-inset - Distance from the viewport edge. Defaults to 1em.
 *
 * @example <tr-toaster placement="top-end"></tr-toaster>
 */
export class TrToaster extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        position: fixed;
        inset: auto;
        z-index: 2147483000;
        display: flex;
        flex-direction: column;
        gap: var(--tr-toaster-gap, 0.5em);
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        overflow: visible;
        pointer-events: none;
        width: max-content;
        max-width: calc(100vw - 2 * var(--tr-toaster-inset, 1em));
        /* a full-height column with the toasts at its end: adding or removing one moves the
           toasts (which glide), never the stack's own box */
        top: 0;
        height: auto; /* the popover UA style is fit-content */
        justify-content: flex-end;
        bottom: max(var(--tr-toaster-inset, 1em), env(safe-area-inset-bottom));
        left: 50%;
        translate: -50% 0;
        /* the stack itself fades in with its first toast (the toast slides inside it) */
        transition: opacity var(--tr-motion-duration-release, 160ms) ease-out;
      }
      @starting-style {
        :host {
          opacity: 0;
        }
      }
      :host([placement='bottom-end']) {
        left: auto;
        right: var(--tr-toaster-inset, 1em);
        translate: none;
      }
      :host([placement='top-center']),
      :host([placement='top-end']) {
        bottom: 0;
        top: max(var(--tr-toaster-inset, 1em), env(safe-area-inset-top));
        flex-direction: column-reverse;
        --_from: -0.75em;
      }
      :host([placement='top-end']) {
        left: auto;
        right: var(--tr-toaster-inset, 1em);
        translate: none;
      }
      :host(:empty) {
        display: none;
      }
      ::slotted(tr-toast) {
        --_from: inherit;
      }
    `,
  ];

  /** Where the stack sits. */
  @property({ reflect: true }) placement: 'bottom-center' | 'bottom-end' | 'top-center' | 'top-end' = 'bottom-center';

  /** Most toasts shown at once; older ones close first. */
  @property({ type: Number, reflect: true }) max = 4;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('popover')) this.setAttribute('popover', 'manual');
    if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', 'Notifications');
    this.setAttribute('role', 'region');
    this.addEventListener('close', this.onClose);
  }

  /** Adds a toast and shows it. Returns the element, so you can close or update it. */
  show(message: string | Node, options: ToastOptions = {}): TrToast {
    const t = document.createElement('tr-toast') as TrToast;
    t.tone = options.tone ?? 'neutral';
    t.duration = options.duration ?? (options.action ? 8000 : 5000);
    t.dismissible = options.dismissible ?? true;
    t.append(message);
    if (options.action) {
      const b = document.createElement('tr-button');
      b.setAttribute('slot', 'action');
      b.setAttribute('size', 'sm');
      b.textContent = options.action.label;
      b.addEventListener('click', () => {
        options.action!.onClick?.();
        t.hide('dismiss');
      });
      t.append(b);
    }
    const before = this.positions();
    this.append(t);
    this.raise();
    const live = [...this.children].filter((c) => (c as TrToast).open) as TrToast[];
    for (const old of live.slice(0, Math.max(0, live.length - this.max + 1))) old.hide('api');
    requestAnimationFrame(async () => {
      t.open = true;
      // measure once the toast has rendered open (still before this frame paints), so the older
      // toasts glide up from where they were instead of jumping
      await t.updateComplete;
      this.glide(before);
    });
    return t;
  }

  /** Puts the stack above anything opened since (dialogs, popovers). */
  private raise(): void {
    try {
      if (this.matches(':popover-open')) this.hidePopover();
      this.showPopover();
    } catch {
      /* no popover support: z-index still applies */
    }
  }

  private positions(): Map<Element, DOMRect> {
    return new Map([...this.children].map((c) => [c, c.getBoundingClientRect()]));
  }

  /** FLIP: toasts that moved because one came or went glide to their new place. */
  private glide(before: Map<Element, DOMRect>): void {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const [el, r] of before) {
      if (!el.isConnected) continue;
      const now = el.getBoundingClientRect();
      const dx = r.left - now.left;
      const dy = r.top - now.top;
      if (Math.abs(dy) < 0.5 && Math.abs(dx) < 0.5) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
    }
  }

  private onClose = async (e: Event): Promise<void> => {
    const t = e.target as TrToast;
    if (t.parentElement !== this) return;
    // It keeps its place while it fades out (no collapse when its display flips to none); once
    // its exit has finished it is removed and the rest glide together.
    t.style.display = 'block';
    await t.updateComplete;
    await new Promise((r) => requestAnimationFrame(r));
    await afterExit(t, 1000);
    if (t.open || t.parentElement !== this) {
      t.style.removeProperty('display');
      return;
    }
    const before = this.positions();
    t.remove();
    t.style.removeProperty('display');
    this.glide(before);
    if (!this.childElementCount) {
      try {
        this.hidePopover();
      } catch {
        /* fine */
      }
    }
  };

  protected override render() {
    return html`<slot></slot>`;
  }
}

export interface ToastOptions {
  /** Meaning; danger toasts are announced assertively. Default neutral. */
  tone?: ToastTone;
  /** Milliseconds before it closes; 0 keeps it. Default 5000 (8000 with an action). */
  duration?: number;
  /** Shows a close key. Default true. */
  dismissible?: boolean;
  /** One action button, e.g. { label: 'Undo', onClick: undo }. */
  action?: { label: string; onClick?: () => void };
  /** Where the shared stack sits (only used when it is created). */
  placement?: TrToaster['placement'];
}

/**
 * Shows a toast in the shared `tr-toaster` (created on first use).
 *
 * ```js
 * import { toast } from 'trompe';
 * toast('Changes saved', { tone: 'success' });
 * toast('Message deleted', { action: { label: 'Undo', onClick: restore } });
 * ```
 */
export function toast(message: string | Node, options: ToastOptions = {}): TrToast {
  let host = document.querySelector('tr-toaster') as TrToaster | null;
  if (!host) {
    host = document.createElement('tr-toaster') as TrToaster;
    if (options.placement) host.placement = options.placement;
    document.body.append(host);
  }
  return host.show(message, options);
}

define('tr-toast', TrToast);
define('tr-toaster', TrToaster);

declare global {
  interface HTMLElementTagNameMap {
    'tr-toast': TrToast;
    'tr-toaster': TrToaster;
  }
}
