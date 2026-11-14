import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { pendingSubmitter } from '../../internal/submitter.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import type { Size } from '../../internal/types.js';

/** Deepest focused element, through shadow roots. */
function deepActive(): HTMLElement | null {
  let a = document.activeElement as HTMLElement | null;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement as HTMLElement;
  return a;
}

const TABBABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"], summary';

/**
 * A plate lifted off the page to the overlay level (depth 4), with a long soft shadow over a
 * dimmed, optionally blurred backdrop, and a recessed tray along the bottom for its actions.
 * Built on a native `<dialog>` in the top layer: the rest of the page is inert while it is open,
 * Escape closes it, and focus returns to whatever opened it.
 *
 * @summary Modal or non-modal dialog (role="dialog" or "alertdialog") on a native <dialog>.
 * @tag tr-dialog
 * @role dialog
 *
 * @slot heading - The dialog title, such as an h2. Names the dialog unless `label` is set. Without it, `label` is shown as the title.
 * @slot header - Extra content next to the heading, such as an icon or status.
 * @slot - The dialog body. It scrolls when the dialog is taller than the viewport.
 * @slot footer - Actions, sitting in the recessed tray, aligned to the end.
 *
 * @csspart dialog - The native dialog element and its surface.
 * @csspart header - Row holding the heading, header slot and close button.
 * @csspart title - The title shown from `label` when there is no `heading` slot.
 * @csspart body - Scrolling body wrapper.
 * @csspart footer - The recessed action tray.
 * @csspart close-button - The built-in close button.
 *
 * @cssprop --tr-dialog-width - Width of the dialog. Defaults by size (24em, 32em, 46em).
 * @cssprop --tr-dialog-max-height - Maximum height. Defaults to 85vh.
 * @cssprop --tr-dialog-radius - Corner radius. Defaults to --tr-radius-lg.
 * @cssprop --tr-dialog-padding - Inner padding. Defaults to 1.5em.
 * @cssprop --tr-dialog-backdrop - Backdrop color. Defaults to the shadow color at 45%, with a vignette.
 * @cssprop --tr-dialog-backdrop-blur - Backdrop blur radius. Defaults to 4px. Set 0 for none.
 *
 * @fires open - The dialog opened.
 * @fires close - The dialog closed. Read `returnValue` for the value passed to close().
 * @fires cancel - The user asked to dismiss the dialog (Escape, or a backdrop click with `light-dismiss`). Cancelable: call preventDefault() to keep it open.
 *
 * @example
 * <tr-button onclick="document.getElementById('d').show()">Delete…</tr-button>
 * <tr-dialog id="d" alert>
 *   <h2 slot="heading">Delete 3 files?</h2>
 *   This can't be undone.
 *   <tr-button slot="footer" onclick="this.closest('tr-dialog').close('cancel')">Cancel</tr-button>
 *   <tr-button slot="footer" tone="danger" onclick="this.closest('tr-dialog').close('delete')">Delete</tr-button>
 * </tr-dialog>
 * @example <tr-dialog label="Settings" light-dismiss material="glass">…</tr-dialog>
 */
export class TrDialog extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_depth: 4;
        --_curve-default: 0.06;
        --_chamfer-default: 1.5px;
        --_w: var(--tr-dialog-width, 32em);
        --_pad: var(--tr-dialog-padding, 1.5em);
        display: contents;
        font-size: var(--tr-font-size-md, 1em);
      }
      :host([size='sm']) {
        --_w: var(--tr-dialog-width, 24em);
      }
      :host([size='lg']) {
        --_w: var(--tr-dialog-width, 46em);
      }
      /* dialog.surface: the shared .surface rule sets position: relative, which in the top layer
         would place the dialog at the top of the document (and scroll the page there) */
      dialog,
      dialog.surface {
        --_tr-z: var(--_depth);
        position: fixed;
        inset: 0;
        margin: auto;
        width: min(var(--_w), calc(100vw - 2em));
        max-width: none;
        max-height: min(var(--tr-dialog-max-height, 85vh), calc(100dvh - 2em));
        padding: 0;
        flex-direction: column;
        overflow: hidden;
        border-radius: var(--tr-dialog-radius, var(--tr-radius-lg, 16px));
        color: var(--_ink);
        font: inherit;
        line-height: 1.5;
        opacity: 0;
        transform: translateY(calc(var(--_sy) * 14px)) scale(0.96);
        transition:
          opacity 140ms ease-in,
          transform 140ms ease-in,
          overlay 140ms allow-discrete,
          display 140ms allow-discrete;
      }
      dialog.surface {
        /* a large plate catches only part of the window reflection */
        --_rg: calc(var(--_r) * (2 - var(--_r)) * 0.35);
      }
      dialog[open] {
        display: flex;
        opacity: 1;
        transform: none;
        transition:
          opacity 180ms ease-out,
          transform 260ms var(--tr-motion-easing-spring, cubic-bezier(0.2, 0.9, 0.3, 1.15)),
          overlay 180ms allow-discrete,
          display 180ms allow-discrete;
      }
      @starting-style {
        dialog[open] {
          opacity: 0;
          transform: translateY(calc(var(--_sy) * 18px)) scale(0.94);
        }
      }
      dialog:focus {
        outline: none;
      }
      dialog:focus-visible {
        outline: 2px solid var(--tr-color-focus);
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
        outline-offset: 3px;
      }
      dialog::backdrop {
        /* a dim room with a pool of light where the dialog sits */
        background:
          radial-gradient(
            ellipse 75% 70% at 50% 45%,
            transparent 0%,
            color-mix(in oklch, var(--tr-color-shadow, #000) 28%, transparent) 100%
          ),
          var(--tr-dialog-backdrop, color-mix(in oklch, var(--tr-color-shadow, #000) 42%, transparent));
        backdrop-filter: blur(var(--tr-dialog-backdrop-blur, 4px)) saturate(0.85);
        opacity: 0;
        transition:
          opacity 160ms ease-in,
          overlay 160ms allow-discrete,
          display 160ms allow-discrete;
      }
      dialog[open]::backdrop {
        opacity: 1;
        transition-timing-function: ease-out;
        transition-duration: 220ms;
      }
      @starting-style {
        dialog[open]::backdrop {
          opacity: 0;
        }
      }
      .header {
        display: flex;
        align-items: flex-start;
        gap: 0.75em;
        padding: var(--_pad) var(--_pad) 0.5em;
      }
      .header.empty {
        padding-bottom: 0;
      }
      .titles {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 0.6em;
        min-height: 2em;
      }
      ::slotted([slot='heading']),
      .title {
        margin: 0;
        font-size: 1.25em;
        font-weight: var(--tr-font-weight-strong, 600);
        line-height: 1.3;
        letter-spacing: -0.005em;
      }
      .body {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        overscroll-behavior: contain;
        padding: 0 var(--_pad) var(--_pad);
      }
      .body ::slotted(:first-child) {
        margin-block-start: 0;
      }
      .body ::slotted(:last-child) {
        margin-block-end: 0;
      }
      .header.empty + .body {
        padding-top: 0;
      }
      .footer {
        --_tr-z: -1;
        --_base: color-mix(in oklch, var(--tr-color-well) 38%, var(--_m-base));
        --_ink: var(--_m-ink);
        --_curve: 0;
        --_chamfer: 0px;
        flex: none;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
        gap: 0.6em;
        padding: 0.9em var(--_pad);
        border-width: 1px 0 0;
        border-radius: 0;
      }
      .footer.surface {
        --_rg: calc(var(--_r) * (2 - var(--_r)) * 0.25);
      }
      .footer[hidden] {
        display: none;
      }
      .close {
        --_tr-z: 1;
        --_curve: var(--tr-p-curve, 0.6);
        --_chamfer: 0px;
        flex: none;
        display: inline-grid;
        place-items: center;
        width: 2em;
        height: 2em;
        margin: 0 calc(var(--_pad) * -0.35) 0 0;
        padding: 0;
        border-radius: 50%;
        font: inherit;
        cursor: pointer;
        transition: --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-spring, ease-out);
      }
      .close:hover {
        --_tr-z: 1.5;
      }
      .close:active {
        --_tr-z: -1;
        transition-duration: var(--tr-motion-duration-press, 70ms);
      }
      .close:focus {
        outline: none;
      }
      .close:focus-visible {
        outline: 2px solid var(--tr-color-focus);
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
        outline-offset: 3px;
      }
      .close svg {
        width: 0.8em;
        height: 0.8em;
      }
      @media (pointer: coarse) {
        .close {
          width: var(--tr-control-touch, 44px);
          height: var(--tr-control-touch, 44px);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        dialog,
        dialog[open] {
          transform: none;
        }
      }
      @media (prefers-reduced-transparency: reduce) {
        dialog::backdrop {
          background: color-mix(in oklch, var(--tr-color-canvas, Canvas) 70%, var(--tr-color-shadow, #000));
          backdrop-filter: none;
        }
        dialog {
          background-color: oklch(from var(--_face) l c h / 1);
          backdrop-filter: none;
        }
      }
      @media (forced-colors: active) {
        dialog {
          border: 2px solid CanvasText;
        }
        dialog::backdrop {
          background: rgb(0 0 0 / 0.5);
          backdrop-filter: none;
        }
      }
    `,
  ];

  /** Whether the dialog is showing. Set it, or call show() and close(). */
  @property({ type: Boolean, reflect: true }) open = false;

  /** The dialog's name. Without a `heading` slot it is also shown as the title (unless `hide-label`). */
  @property() label = '';

  /** Keeps `label` as the accessible name only, without showing it as the title. */
  @property({ type: Boolean, reflect: true, attribute: 'hide-label' }) hideLabel = false;

  /** Opens without a backdrop and leaves the page interactive (non-modal). */
  @property({ type: Boolean, reflect: true, attribute: 'non-modal' }) nonModal = false;

  /** Clicking the backdrop dismisses the dialog (fires a cancelable `cancel` first). */
  @property({ type: Boolean, reflect: true, attribute: 'light-dismiss' }) lightDismiss = false;

  /** Uses role="alertdialog": for urgent confirmations that need a response. */
  @property({ type: Boolean, reflect: true }) alert = false;

  /** Hides the built-in close button. Then give the dialog another way to close. */
  @property({ type: Boolean, reflect: true, attribute: 'no-close-button' }) noCloseButton = false;

  /** Accessible name of the close button. */
  @property({ attribute: 'close-label' }) closeLabel = 'Close';

  /** Width preset. */
  @property({ reflect: true }) size: Size = 'md';

  /** The value passed to the last close(). */
  returnValue = '';

  @query('dialog') private dialog!: HTMLDialogElement;
  @state() private hasHeading = false;
  @state() private hasFooter = false;
  @state() private hasHeader = false;
  private opener: HTMLElement | null = null;
  private downOnBackdrop = false;

  constructor() {
    super();
    this.addEventListener('submit', this.onSubmit);
  }

  protected override render() {
    const showHeader = this.hasHeading || this.hasHeader || !this.noCloseButton || (!!this.label && !this.hideLabel);
    return html`<dialog
      part="dialog"
      class="surface"
      role=${this.alert ? 'alertdialog' : nothing}
      aria-modal=${this.nonModal ? nothing : 'true'}
      @cancel=${this.onNativeCancel}
      @close=${this.onNativeClose}
      @pointerdown=${this.onPointerDown}
      @click=${this.onDialogClick}
      @keydown=${this.onDialogKeyDown}
    >
      <div part="header" class="header ${showHeader ? '' : 'empty'}">
        <div class="titles">
          <slot name="heading" @slotchange=${this.onSlotChange}
            >${this.label && !this.hideLabel ? html`<h2 part="title" class="title" aria-hidden="true">${this.label}</h2>` : nothing}</slot
          >
          <slot name="header" @slotchange=${this.onSlotChange}></slot>
        </div>
        ${this.noCloseButton
          ? nothing
          : html`<button part="close-button" class="close surface" type="button" aria-label=${this.closeLabel} @click=${() => this.close()}>
              <svg viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7"/></svg>
            </button>`}
      </div>
      <div part="body" class="body"><slot></slot></div>
      <div part="footer" class="footer surface" ?hidden=${!this.hasFooter}><slot name="footer" @slotchange=${this.onSlotChange}></slot></div>
    </dialog>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('label') || changed.has('hasHeading')) this.syncLabel();
    if (changed.has('open')) this.sync();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.dialog?.open) this.dialog.close();
  }

  /** Opens the dialog (modal unless `non-modal`). */
  show(): void {
    this.open = true;
  }

  /** Closes the dialog. `returnValue` is kept on the element for `close` listeners. */
  close(returnValue?: string): void {
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.open = false;
  }

  private sync(): void {
    const d = this.dialog;
    if (!d) return;
    if (this.open && !d.open) {
      this.opener = deepActive();
      this.returnValue = '';
      try {
        if (this.nonModal) d.show();
        else d.showModal();
      } catch {
        // Not connected, or already open as the other kind: give up quietly.
        this.open = false;
        return;
      }
      this.focusInitial();
      this.dispatchEvent(new Event('open'));
    } else if (!this.open && d.open) {
      d.close(this.returnValue);
    }
  }

  /** APG: focus [autofocus], else the first tabbable control in the body or footer, else the close button. */
  private focusInitial(): void {
    const auto = this.querySelector<HTMLElement>('[autofocus]');
    // Hosts that delegate focus (tr-input, tr-textarea) keep tabIndex -1 but still take focus.
    const delegates = (el: HTMLElement) => !!el.shadowRoot?.delegatesFocus && !el.matches(':disabled, [disabled]');
    const focusable = `${TABBABLE}, tr-button, tr-switch, tr-checkbox, tr-select`;
    const lightTabbable = [...this.querySelectorAll<HTMLElement>('*')].find(
      (el) =>
        ((el.tabIndex >= 0 && el.matches(focusable)) || delegates(el)) &&
        !el.closest('[slot="heading"], [slot="header"]') &&
        el.getClientRects().length > 0,
    );
    const close = this.renderRoot.querySelector<HTMLElement>('.close');
    const target = auto ?? lightTabbable ?? close ?? this.dialog;
    if (target === this.dialog) this.dialog.tabIndex = -1;
    target.focus({ preventScroll: true });
  }

  private syncLabel(): void {
    const d = this.dialog;
    if (!d) return;
    const headings = this.headingElements();
    const text = headings.map((h) => h.textContent ?? '').join(' ').replace(/\s+/g, ' ').trim();
    const name = this.label || text;
    if (name) d.setAttribute('aria-label', name);
    else d.removeAttribute('aria-label');
    // Real labelledby relation where ARIA element reflection exists (it can reach the light DOM).
    const el = d as HTMLDialogElement & { ariaLabelledByElements?: Element[] | null };
    if ('ariaLabelledByElements' in el) el.ariaLabelledByElements = !this.label && headings.length ? headings : null;
  }

  private headingElements(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>(':scope > [slot="heading"]')];
  }

  private onSlotChange = (): void => {
    this.hasHeading = this.headingElements().length > 0;
    this.hasHeader = !!this.querySelector(':scope > [slot="header"]');
    this.hasFooter = !!this.querySelector(':scope > [slot="footer"]');
    this.syncLabel();
  };

  private requestDismiss(): void {
    const ev = new Event('cancel', { cancelable: true });
    this.dispatchEvent(ev);
    if (!ev.defaultPrevented) this.close();
  }

  private onNativeCancel = (e: Event): void => {
    e.preventDefault();
    this.requestDismiss();
  };

  private onNativeClose = (): void => {
    // The native close event is a queued task: if the dialog was reopened meanwhile
    // (close() then open = true), it is a stale report and must not close it again.
    if (this.dialog.open) return;
    this.open = false;
    const active = deepActive();
    const lost = !active || active === document.body || this.contains(active) || this.renderRoot.contains(active);
    if (lost && this.opener?.isConnected) this.opener.focus({ preventScroll: true });
    this.opener = null;
    this.dispatchEvent(new Event('close'));
  };

  private onDialogKeyDown = (e: KeyboardEvent): void => {
    // Non-modal dialogs get no close request from the browser; handle Escape ourselves.
    if (this.nonModal && e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault();
      this.requestDismiss();
    }
  };

  private outside(e: MouseEvent): boolean {
    const r = this.dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.downOnBackdrop = e.target === this.dialog && this.outside(e);
  };

  private onDialogClick = (e: MouseEvent): void => {
    const onBackdrop = e.target === this.dialog && this.outside(e) && this.downOnBackdrop;
    this.downOnBackdrop = false;
    if (onBackdrop && this.lightDismiss) this.requestDismiss();
  };

  /** Light-DOM forms with method="dialog" close the dialog with the submitter's value. */
  private onSubmit = (e: SubmitEvent): void => {
    const form = e.target as HTMLFormElement;
    if (form.getAttribute('method')?.toLowerCase() !== 'dialog') return;
    e.preventDefault();
    // A tr-button cannot be a native submitter (e.submitter is null): it records itself instead.
    const submitter = (e.submitter as HTMLButtonElement | null) ?? pendingSubmitter(form);
    this.close(submitter?.value ?? '');
  };
}

define('tr-dialog', TrDialog);

declare global {
  interface HTMLElementTagNameMap {
    'tr-dialog': TrDialog;
  }
}
