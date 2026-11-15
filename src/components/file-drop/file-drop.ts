import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { FormControl } from '../../internal/form-control.js';
import { SizeTransition, crossfadeText, insertAnimated } from '../../interaction/smooth.js';
import { reducedMotion } from '../../interaction/motion.js';
import { define } from '../../internal/trompe-element.js';
import '../icon/icon.js';

/** Parses a size such as `10485760`, `"10MB"`, `"500 KB"` or `"1.5 GB"` into bytes. */
export function parseFileSize(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const m = /^\s*([\d.]+)\s*([kmgt]?i?b?)?\s*$/i.exec(v);
  if (!m) return Number(v) || 0;
  const n = parseFloat(m[1]!);
  const u = (m[2] ?? '').toLowerCase().replace(/i?b$/, '');
  const pow = { '': 0, k: 1, m: 2, g: 3, t: 4 }[u] ?? 0;
  return Math.round(n * 1024 ** pow);
}

/** Formats bytes for people: "820 KB", "1.4 MB". */
export function formatFileSize(bytes: number, locale?: string): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const digits = i === 0 || n >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n)} ${units[i]}`;
}

/** Whether a file (or a dragged item's MIME type) matches an `accept` list. */
function matches(accept: string[], type: string, name = ''): boolean {
  if (!accept.length) return true;
  const t = type.toLowerCase();
  const n = name.toLowerCase();
  return accept.some((a) => {
    if (a.startsWith('.')) return n ? n.endsWith(a) : false;
    if (a.endsWith('/*')) return t.startsWith(a.slice(0, -1));
    return t === a;
  });
}

/** Words for an accept list: ".pdf,image/*" → "PDF or image". */
function describeAccept(accept: string[]): string {
  const words = accept.map((a) => {
    if (a.startsWith('.')) return a.slice(1).toUpperCase();
    if (a.endsWith('/*')) return a.slice(0, -2);
    const sub = a.split('/')[1] ?? a;
    return sub === 'pdf' ? 'PDF' : sub.replace(/^x-/, '').toUpperCase();
  });
  const uniq = [...new Set(words)];
  return uniq.length <= 1 ? (uniq[0] ?? '') : `${uniq.slice(0, -1).join(', ')} or ${uniq[uniq.length - 1]}`;
}

const ids = new WeakMap<File, number>();
let nextId = 1;
const idOf = (f: File) => {
  let id = ids.get(f);
  if (!id) ids.set(f, (id = nextId++));
  return id;
};

const iconFor = (f: File) =>
  f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') ? 'music' : f.type.startsWith('video/') ? 'video' : /pdf|text|document|sheet|presentation|msword/.test(f.type) || /\.(pdf|docx?|txt|md|csv|xlsx?|pptx?)$/i.test(f.name) ? 'file' : 'paperclip';

/**
 * A recessed tray that takes files: drop them on it, or press it to open the file picker. It
 * lights up while files are dragged over it (and tints when they would be refused), then lists
 * what was added, with a remove key per file. Rows slide in and out, messages fade, and the box
 * glides to its new height, so nothing around it jumps.
 *
 * It takes part in forms: the files are submitted under `name` (as a native file input would),
 * `required` needs at least one, and files of the wrong type, too large or over `max-files` are
 * refused with a message that says why.
 *
 * @summary File drop area and picker, form-associated.
 * @tag tr-file-drop
 *
 * @csspart label - The visible label.
 * @csspart tray - The recessed drop tray (a button that opens the file picker).
 * @csspart icon - The icon in the tray.
 * @csspart prompt - The tray's text.
 * @csspart files - The list of added files.
 * @csspart file - One added file row.
 * @csspart file-icon - The type icon of a file row.
 * @csspart file-name - The file's name.
 * @csspart file-size - The file's size.
 * @csspart remove - A file row's remove key.
 * @csspart hint - The help text under the tray.
 * @csspart error - The error message under the tray.
 *
 * @cssprop --tr-file-drop-color - Color of the tray. Defaults to --tr-color-well.
 * @cssprop --tr-file-drop-radius - Corner radius of the tray. Defaults to --tr-radius-lg.
 * @cssprop --tr-file-drop-height - Minimum height of the tray. Defaults to 7.5em (the control height when compact).
 * @cssprop --tr-file-drop-accent - Color of the lit rim while dragging. Defaults to --tr-color-accent.
 * @cssprop --tr-file-drop-error-color - Color of the error message and refusing rim. Defaults to --tr-color-danger.
 *
 * @fires change - Files were added or removed. `detail.files` holds all current files.
 * @fires remove - A file was removed with its remove key. `detail.file` is the file.
 *
 * @example <tr-file-drop label="Receipt" name="receipt" accept=".pdf,image/*" max-size="10MB" hint="A PDF or photo, up to 10 MB."></tr-file-drop>
 * @example <tr-file-drop label="Attachments" name="files" multiple max-files="5"></tr-file-drop>
 * @example <tr-file-drop compact aria-label="Receipt for line 1" accept="image/*,.pdf"></tr-file-drop>
 */
export class TrFileDrop extends FormControl {
  static override shadowRootOptions: ShadowRootInit = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static override styles = [
    ...FormControl.styles,
    css`
      :host {
        --_acc: var(--tr-file-drop-accent, var(--tr-color-accent));
        --_err: var(--tr-file-drop-error-color, var(--tr-color-danger));
        /* no gap: parts that come and go (the file list, messages) bring their own spacing,
           which they animate, so nothing jumps when they appear */
        display: flex;
        flex-direction: column;
        min-width: 0;
        max-width: 100%;
        font-size: var(--tr-font-size-md, 1em);
        transition: opacity var(--tr-motion-duration-release, 160ms) ease-out;
      }
      .label {
        margin-bottom: calc(0.35em / 0.8125);
        font-size: 0.8125em;
        font-weight: var(--tr-font-weight-strong, 600);
        letter-spacing: 0.02em;
        line-height: 1.3;
      }
      .sr {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
      .label[hidden] {
        display: none;
      }

      /* ---------- the tray: a well pressed into the face, with a stitched rim ---------- */
      .tray {
        --_tr-z: -2;
        --_base: var(--tr-file-drop-color, var(--tr-color-well));
        --_ink: var(--tr-color-ink);
        --_edge: var(--_edge-strong);
        --_brush: 0;
        --_spin: 0;
        --_gloss: 0;
        --_mirror: 0;
        --_curve: 0;
        --_sel: 0;
        position: relative;
        isolation: isolate;
        display: grid;
        grid-template-columns: auto;
        justify-items: center;
        align-content: center;
        gap: 0.45em;
        width: 100%;
        min-height: var(--tr-file-drop-height, 7.5em);
        margin: 0;
        padding: 1.1em 1.25em;
        border-radius: var(--tr-file-drop-radius, var(--tr-radius-lg, 14px));
        font: inherit;
        color: inherit;
        text-align: center;
        cursor: pointer;
        transition:
          --_tr-z var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out),
          --_sel var(--tr-motion-duration-travel, 220ms) ease-out,
          box-shadow var(--tr-motion-duration-release, 160ms),
          border-color var(--tr-motion-duration-release, 160ms);
        --_layer: linear-gradient(
          calc(var(--tr-light-angle, 330deg) + 180deg),
          color-mix(in oklch, var(--_sh) calc(var(--_r) * 10%), transparent),
          transparent 45%,
          color-mix(in oklab, var(--_hl) calc(var(--_r) * 12%), transparent)
        );
      }
      /* the stitched rim: a dashed seam set in from the edge, catching the accent when lit */
      .tray > .rim {
        position: absolute;
        inset: 0.45em;
        border: 1.5px dashed color-mix(in oklch, var(--tr-color-ink) 22%, transparent);
        border-radius: calc(var(--tr-file-drop-radius, var(--tr-radius-lg, 14px)) - 0.3em);
        pointer-events: none;
        z-index: -1;
        transition: border-color var(--tr-motion-duration-release, 160ms) ease-out;
      }
      /* the light under the tray while files hover over it */
      .tray::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: radial-gradient(ellipse at 50% 55%, color-mix(in oklch, var(--_glow, var(--_acc)) 22%, transparent), transparent 72%);
        box-shadow:
          inset 0 0 0 1.5px color-mix(in oklch, var(--_glow, var(--_acc)) 70%, transparent),
          0 0 calc(6px + var(--_r) * 12px) color-mix(in oklch, var(--_glow, var(--_acc)) calc(var(--_r) * 35%), transparent);
        opacity: 0;
        pointer-events: none;
        z-index: -1;
        transition: opacity var(--tr-motion-duration-release, 160ms) ease-out;
      }
      .tray:hover {
        --_tr-z: -1.6;
      }
      .tray:hover > .rim {
        border-color: color-mix(in oklch, var(--tr-color-ink) 36%, transparent);
      }
      .tray:active {
        --_tr-z: -2.6;
        transition-duration: var(--tr-motion-duration-press, 70ms);
      }
      .tray:focus-visible {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 2px;
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      :host([data-drag]) .tray {
        --_tr-z: -0.6;
        --_sel: 1;
      }
      :host([data-drag]) .tray::after {
        opacity: 1;
      }
      :host([data-drag]) .tray > .rim {
        border-color: color-mix(in oklch, var(--_glow, var(--_acc)) 85%, transparent);
      }
      :host([data-drag='invalid']) .tray {
        --_glow: var(--_err);
        --_tr-z: -2;
        cursor: no-drop;
      }
      :host([data-user-invalid]) .tray {
        --_edge: var(--_err);
        --_edge-strong: var(--_err);
      }
      :host([data-user-invalid]) .tray > .rim {
        border-color: color-mix(in oklch, var(--_err) 70%, transparent);
      }

      .icon {
        font-size: 1.6em;
        color: var(--tr-color-ink-muted);
        transition:
          color var(--tr-motion-duration-release, 160ms) ease-out,
          translate var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out);
      }
      :host([data-drag]) .icon {
        color: var(--_glow, var(--_acc));
        translate: 0 -0.12em;
      }
      /* the prompt and "Drop to add" share one cell, so swapping them moves nothing */
      .prompt {
        display: grid;
        line-height: 1.35;
      }
      .prompt > span {
        grid-area: 1 / 1;
        transition:
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          translate var(--tr-motion-duration-travel, 220ms) cubic-bezier(0.2, 0.7, 0.2, 1);
      }
      .choose {
        color: color-mix(in oklch, var(--_acc) 80%, var(--tr-color-ink));
        font-weight: var(--tr-font-weight-strong, 600);
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 0.18em;
      }
      .over {
        opacity: 0;
        translate: 0 0.3em;
        font-weight: var(--tr-font-weight-strong, 600);
      }
      :host([data-drag]) .idle {
        opacity: 0;
        translate: 0 -0.3em;
      }
      :host([data-drag]) .over {
        opacity: 1;
        translate: none;
      }
      .rules {
        font-size: 0.8125em;
        color: var(--tr-color-ink-muted);
      }
      .rules:empty {
        display: none;
      }

      /* compact: one line, the height of a control, for table rows and dense forms */
      :host([compact]) .tray {
        grid-auto-flow: column;
        justify-content: start;
        justify-items: start;
        align-items: center;
        gap: 0.55em;
        min-height: var(--tr-file-drop-height, var(--tr-control-md, 2.5em));
        padding: 0.35em 0.85em;
        border-radius: var(--tr-file-drop-radius, var(--tr-radius-md, 10px));
        text-align: start;
      }
      :host([compact]) .tray > .rim {
        inset: 0.25em;
        border-radius: calc(var(--tr-file-drop-radius, var(--tr-radius-md, 10px)) - 0.2em);
      }
      :host([compact]) .icon {
        font-size: 1.1em;
      }
      :host([compact]) .rules {
        display: none;
      }
      :host([compact]) .prompt {
        font-size: 0.9375em;
      }

      /* ---------- added files ---------- */
      .files {
        display: grid;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .file {
        display: flex;
        align-items: center;
        gap: 0.6em;
        min-width: 0;
        padding: 0.45em 0.25em 0.45em 0.6em;
        /* a drawn rule, not a border: a row opening from zero height then has no 1px to jump */
        box-shadow: inset 0 -1px 0 color-mix(in oklch, var(--tr-color-ink) 10%, transparent);
        line-height: 1.3;
      }
      .file:first-child {
        margin-top: 0.4em;
      }
      .file:last-child {
        box-shadow: none;
      }
      .file-icon {
        flex: none;
        color: var(--tr-color-ink-muted);
      }
      .file-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .file-size {
        flex: none;
        font-size: 0.8125em;
        font-variant-numeric: tabular-nums;
        color: var(--tr-color-ink-muted);
      }
      .remove {
        flex: none;
        display: inline-grid;
        place-items: center;
        width: 1.75em;
        height: 1.75em;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--tr-color-ink-muted);
        font: inherit;
        cursor: pointer;
        transition:
          background-color var(--tr-motion-duration-release, 160ms),
          color var(--tr-motion-duration-release, 160ms),
          scale var(--tr-motion-duration-press, 70ms);
      }
      .remove:hover {
        background: color-mix(in oklch, var(--tr-color-ink) 10%, transparent);
        color: var(--tr-color-ink);
      }
      .remove:active {
        scale: 0.9;
      }
      .remove:focus-visible {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: 1px;
        animation: tr-focus-in var(--tr-motion-duration-release, 160ms) cubic-bezier(0.2, 0.7, 0.2, 1);
      }

      /* ---------- hint and error, as on tr-input ---------- */
      .hint,
      .error {
        display: flex;
        align-items: flex-start;
        gap: 0.35em;
        font-size: 0.8125em;
        line-height: 1.35;
      }
      .hint {
        color: color-mix(in oklch, currentColor 72%, transparent);
      }
      .error {
        --_err-ink: var(--tr-color-danger-ink, #fff);
        color: color-mix(in oklch, var(--_err) 78%, currentColor);
        font-weight: var(--tr-font-weight-strong, 600);
      }
      .error svg {
        flex: none;
        margin-top: 0.12em;
      }
      .messages {
        margin-top: 0;
      }
      .stack {
        display: grid;
      }
      .msg {
        margin-top: calc(0.35em / 0.8125);
        transition:
          opacity var(--tr-motion-duration-release, 160ms) ease-out,
          translate var(--tr-motion-duration-travel, 220ms) cubic-bezier(0.2, 0.7, 0.2, 1),
          display var(--tr-motion-duration-release, 160ms) allow-discrete;
      }
      .msg[hidden] {
        display: none;
        opacity: 0;
        translate: 0 -0.3em;
        transition-timing-function: ease-in;
      }
      @starting-style {
        .msg {
          opacity: 0;
          translate: 0 -0.3em;
        }
      }
      input[type='file'] {
        display: none;
      }

      :host([disabled]),
      :host(:state(disabled)) {
        opacity: 0.55;
      }
      :host([disabled]) .tray,
      :host(:state(disabled)) .tray {
        cursor: not-allowed;
        --_tr-z: -2;
      }
      @media (pointer: coarse) {
        :host([compact]) .tray {
          min-height: max(var(--tr-file-drop-height, var(--tr-control-md, 2.5em)), var(--tr-control-touch, 44px));
        }
        .remove {
          width: var(--tr-control-touch, 44px);
          height: var(--tr-control-touch, 44px);
          margin: -0.5em -0.4em;
        }
      }
      @media (forced-colors: active) {
        .tray {
          border: 1px solid ButtonText;
          background: Canvas;
        }
        .tray > .rim {
          border-color: ButtonText;
        }
        :host([data-drag]) .tray > .rim {
          border-color: Highlight;
          border-style: solid;
        }
        .tray:focus-visible {
          outline-color: Highlight;
        }
        :host([data-user-invalid]) .tray > .rim {
          border-color: Mark;
        }
      }
    `,
  ];

  /** Visible label above the tray. Also the accessible name of the tray. */
  @property({ reflect: true }) label = '';

  /** File types it takes, as on a native file input: `.pdf,image/*`. */
  @property({ reflect: true }) accept = '';

  /** Takes several files. Without it, a new file replaces the one already added. */
  @property({ type: Boolean, reflect: true }) multiple = false;

  /** Largest file it takes, in bytes or with a unit: `10MB`, `500 KB`. */
  @property({ attribute: 'max-size', reflect: true }) maxSize = '';

  /** Most files it holds (with `multiple`). */
  @property({ attribute: 'max-files', type: Number, reflect: true }) maxFiles?: number;

  /** Requires at least one file for the form to be valid. */
  @property({ type: Boolean, reflect: true }) required = false;

  /** Help text under the tray, linked to it with aria-describedby. */
  @property({ reflect: true }) hint = '';

  /**
   * Error message. Setting it marks the field invalid (a custom validity error) and shows the
   * message under the tray; clear it to make the field valid again.
   */
  @property({ reflect: true }) error = '';

  /** One line, the height of a control: for table rows and dense forms. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Accessible name when there is no visible label. */
  @property({ attribute: 'aria-label', reflect: false }) accessibleLabel: string | null = null;

  @state() private list: File[] = [];
  /** Why the last files were refused (shown until the next change). */
  @state() private refused = '';

  @query('input[type="file"]') private input!: HTMLInputElement;
  @query('.tray') private tray!: HTMLButtonElement;

  protected readonly messageSize = new SizeTransition(this, () => ({
    outer: this.renderRoot?.querySelector<HTMLElement>('.messages'),
    inner: this.renderRoot?.querySelector<HTMLElement>('.stack'),
  }));
  private shownError = '';
  private visibleError = '';
  private renderedError = '';
  private dragDepth = 0;
  private rendered = new Set<number>();
  private leaving = new Set<number>();
  private touched = false;

  constructor() {
    super();
    this.hostFocusable = false;
    this.addEventListener('invalid', this.onInvalid);
    this.addEventListener('dragenter', this.onDragEnter);
    this.addEventListener('dragover', this.onDragOver);
    this.addEventListener('dragleave', this.onDragLeave);
    this.addEventListener('drop', this.onDrop);
  }

  /** The files added, in order. Set an array to replace them (`[]` clears). */
  get files(): File[] {
    return [...this.list];
  }
  set files(v: File[] | FileList | null | undefined) {
    this.list = v ? [...v] : [];
    this.refused = '';
  }

  get validity(): ValidityState {
    return this.internals.validity;
  }

  get validationMessage(): string {
    return this.internals.validationMessage;
  }

  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  reportValidity(): boolean {
    return this.internals.reportValidity();
  }

  /** Opens the file picker. */
  showPicker(): void {
    if (this.isDisabled) return;
    this.input?.click();
  }

  private get acceptList(): string[] {
    return this.accept
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  private get maxBytes(): number {
    return parseFileSize(this.maxSize);
  }

  /** "PDF or image, up to 10 MB": the rules in words, shown in the tray. */
  private get rulesText(): string {
    const kinds = describeAccept(this.acceptList);
    const max = this.maxBytes ? `up to ${formatFileSize(this.maxBytes)}` : '';
    const count = this.multiple && this.maxFiles ? `${this.maxFiles} files at most` : '';
    const s = [kinds, max, count].filter(Boolean).join(', ');
    return s ? s[0]!.toUpperCase() + s.slice(1) : '';
  }

  protected override render() {
    const name = this.label ? undefined : (this.accessibleLabel ?? undefined);
    const showError = Boolean(this.error) || Boolean(this.refused) || this.hasAttribute('data-user-invalid');
    const errorText = this.error || this.refused || (showError ? this.internals.validationMessage : '') || '';
    this.renderedError = showError && errorText ? errorText : '';
    const describedBy = [this.hint ? 'hint' : '', this.renderedError ? 'error' : ''].filter(Boolean).join(' ');
    const several = this.multiple;
    return html`
      <span part="label" class="label" id="label" ?hidden=${!this.label}>${this.label}</span>
      <button
        part="tray"
        class="tray surface"
        type="button"
        ?disabled=${this.isDisabled}
        aria-labelledby=${this.label ? 'label prompt' : name ? 'name prompt' : 'prompt'}
        aria-describedby=${describedBy || nothing}
        aria-invalid=${showError ? 'true' : nothing}
        @click=${this.showPicker}
      >
        <span class="rim" aria-hidden="true"></span>
        ${name ? html`<span class="sr" id="name">${name}</span>` : nothing}
        <tr-icon part="icon" class="icon" name="upload"></tr-icon>
        <span part="prompt" class="prompt" id="prompt">
          <span class="idle">Drop ${several ? 'files' : 'a file'} here or <span class="choose">choose ${several ? 'files' : 'one'}</span></span>
          <span class="over" aria-hidden="true">${this.getAttribute('data-drag') === 'invalid' ? 'Not this kind of file' : 'Drop to add'}</span>
        </span>
        <span class="rules">${this.rulesText}</span>
      </button>
      <input type="file" tabindex="-1" aria-hidden="true" accept=${this.accept || nothing} ?multiple=${this.multiple} @change=${this.onPicked} />
      <ul part="files" class="files" aria-label=${this.list.length ? `${this.label || this.accessibleLabel || 'Files'}: ${this.list.length} added` : nothing}>
        ${repeat(
          this.list,
          (f) => idOf(f),
          (f) => html`<li part="file" class="file" data-id=${idOf(f)}>
            <tr-icon part="file-icon" class="file-icon" name=${iconFor(f)}></tr-icon>
            <span part="file-name" class="file-name" title=${f.name}>${f.name}</span>
            <span part="file-size" class="file-size">${formatFileSize(f.size)}</span>
            <button part="remove" class="remove" type="button" aria-label=${`Remove ${f.name}`} ?disabled=${this.isDisabled} @click=${() => this.removeFile(f)}>
              <tr-icon name="close"></tr-icon>
            </button>
          </li>`,
        )}
      </ul>
      <div class="messages">
        <div class="stack">
          <div part="hint" id="hint" class="msg hint" ?hidden=${!this.hint}>${this.hint}</div>
          <div part="error" id="error" class="msg error" role=${this.refused ? 'alert' : nothing} ?hidden=${!this.renderedError}>
            <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="M8 4.2v4.6M8 10.9v.9" stroke="var(--_err-ink, #fff)" stroke-width="1.8" stroke-linecap="round" /></svg>
            <span class="error-text">${errorText || this.shownError}</span>
          </div>
        </div>
      </div>
    `;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.get('hint') && this.hint) crossfadeText(this.renderRoot.querySelector<HTMLElement>('.hint'), changed.get('hint') as string);
    this.syncForm();
    // New rows open from nothing, so what follows slides down instead of jumping.
    const now = new Set(this.list.map(idOf));
    const first = !this.hasUpdated || changed.size === 0;
    for (const row of this.renderRoot.querySelectorAll<HTMLElement>('.file')) {
      const id = Number(row.dataset.id);
      if (!this.rendered.has(id) && !first && this.isConnected) insertAnimated(row);
    }
    this.rendered = now;
    const text = this.renderRoot.querySelector<HTMLElement>('.error-text');
    const err = this.renderedError;
    if (text && err && this.visibleError && err !== this.visibleError) crossfadeText(text, this.visibleError);
    this.visibleError = err;
    if (err) this.shownError = err;
    if (changed.has('error')) {
      if (this.error) this.setAttribute('data-user-invalid', '');
      else if (changed.get('error') && this.internals.validity.valid) this.removeAttribute('data-user-invalid');
      this.requestUpdate();
    }
  }

  formResetCallback(): void {
    this.list = [];
    this.refused = '';
    this.touched = false;
    this.removeAttribute('data-user-invalid');
  }

  private syncForm(): void {
    if (this.name && this.list.length) {
      const fd = new FormData();
      for (const f of this.list) fd.append(this.name, f);
      this.internals.setFormValue(fd);
    } else {
      this.internals.setFormValue(null);
    }
    const anchor = this.tray ?? undefined;
    if (this.error) this.internals.setValidity({ customError: true }, this.error, anchor);
    else if (this.required && !this.list.length) this.internals.setValidity({ valueMissing: true }, this.multiple ? 'Add at least one file.' : 'Add a file.', anchor);
    else this.internals.setValidity({});
    if (this.touched && !this.error) this.toggleAttribute('data-user-invalid', !this.internals.validity.valid || Boolean(this.refused));
  }

  /** Adds files, refusing what doesn't fit the rules. Returns the files taken. */
  private take(incoming: File[]): File[] {
    const accept = this.acceptList;
    const max = this.maxBytes;
    const ok: File[] = [];
    const reasons: string[] = [];
    for (const f of incoming) {
      if (!matches(accept, f.type, f.name)) reasons.push(`“${f.name}” isn’t a ${describeAccept(accept)} file.`);
      else if (max && f.size > max) reasons.push(`“${f.name}” is ${formatFileSize(f.size)}; the limit is ${formatFileSize(max)}.`);
      else ok.push(f);
    }
    let next = this.multiple ? [...this.list, ...ok] : ok.length ? [ok[ok.length - 1]!] : this.list;
    if (!this.multiple && ok.length > 1) reasons.push('Only one file can be added here.');
    if (this.multiple && this.maxFiles && next.length > this.maxFiles) {
      reasons.push(`You can add up to ${this.maxFiles} file${this.maxFiles === 1 ? '' : 's'}.`);
      next = next.slice(0, this.maxFiles);
    }
    const taken = next.filter((f) => !this.list.includes(f));
    this.touched = true;
    this.refused = reasons[0] ?? '';
    if (taken.length || next.length !== this.list.length) {
      this.list = next;
      this.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true, detail: { files: this.files } }));
    }
    return taken;
  }

  private async removeFile(f: File): Promise<void> {
    if (this.isDisabled) return;
    const id = idOf(f);
    const row = this.renderRoot.querySelector<HTMLElement>(`.file[data-id="${id}"]`);
    const index = this.list.indexOf(f);
    // Focus moves to the next remove key (or the tray), never to the page.
    const rows = [...this.renderRoot.querySelectorAll<HTMLElement>('.file')];
    const next = rows[index + 1] ?? rows[index - 1];
    if (row && !reducedMotion(this) && typeof row.animate === 'function') {
      this.leaving.add(id);
      row.inert = true;
      const cs = getComputedStyle(row);
      const h = row.getBoundingClientRect().height;
      row.style.overflow = 'clip';
      const a = row.animate(
        [
          { height: `${h}px`, opacity: 1, paddingBlockStart: cs.paddingBlockStart, paddingBlockEnd: cs.paddingBlockEnd, marginBlockStart: cs.marginBlockStart },
          { height: '0px', opacity: 0, paddingBlockStart: '0px', paddingBlockEnd: '0px', marginBlockStart: '0px' },
        ],
        { duration: 200, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'forwards' },
      );
      if (next) next.querySelector<HTMLElement>('.remove')?.focus({ preventScroll: true });
      else this.tray?.focus({ preventScroll: true });
      await a.finished.catch(() => {});
      this.leaving.delete(id);
      this.list = this.list.filter((x) => x !== f);
      await this.updateComplete;
      a.cancel();
      row.style.removeProperty('overflow');
    } else {
      this.list = this.list.filter((x) => x !== f);
      await this.updateComplete;
      const rest = this.renderRoot.querySelectorAll<HTMLElement>('.remove');
      (rest[Math.min(index, rest.length - 1)] ?? this.tray)?.focus({ preventScroll: true });
    }
    this.refused = '';
    this.touched = true;
    this.dispatchEvent(new CustomEvent('remove', { bubbles: true, composed: true, detail: { file: f } }));
    this.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true, detail: { files: this.files } }));
  }

  private onPicked = (): void => {
    const picked = [...(this.input.files ?? [])];
    // The native input only carries the last pick; the element keeps the list.
    this.input.value = '';
    if (picked.length) this.take(picked);
  };

  private dragKind(e: DragEvent): 'over' | 'invalid' | null {
    const dt = e.dataTransfer;
    if (!dt || ![...dt.types].includes('Files')) return null;
    const items = [...dt.items].filter((i) => i.kind === 'file');
    const accept = this.acceptList;
    // Names are hidden while dragging; judge by MIME type where it is known.
    if (accept.length && items.length && items.every((i) => i.type && !accept.some((a) => !a.startsWith('.') && matches([a], i.type))) && !accept.some((a) => a.startsWith('.'))) return 'invalid';
    if (!this.multiple && items.length > 1) return 'invalid';
    return 'over';
  }

  private setDrag(kind: 'over' | 'invalid' | null): void {
    const was = this.getAttribute('data-drag');
    if (was === kind) return;
    if (kind) this.setAttribute('data-drag', kind);
    else this.removeAttribute('data-drag');
    this.requestUpdate();
  }

  private onDragEnter = (e: DragEvent): void => {
    if (this.isDisabled) return;
    const kind = this.dragKind(e);
    if (!kind) return;
    e.preventDefault();
    this.dragDepth++;
    this.setDrag(kind);
  };

  private onDragOver = (e: DragEvent): void => {
    if (this.isDisabled) return;
    const kind = this.dragKind(e);
    if (!kind) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = kind === 'invalid' ? 'none' : 'copy';
    this.setDrag(kind);
  };

  private onDragLeave = (e: DragEvent): void => {
    if (!this.hasAttribute('data-drag')) return;
    // Leaving for a child of the element is not leaving.
    if (e.relatedTarget instanceof Node && (this.contains(e.relatedTarget) || this.renderRoot.contains(e.relatedTarget))) return;
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0 || !e.relatedTarget) {
      this.dragDepth = 0;
      this.setDrag(null);
    }
  };

  private onDrop = (e: DragEvent): void => {
    if (this.isDisabled || !this.dragKind(e)) return;
    e.preventDefault();
    this.dragDepth = 0;
    this.setDrag(null);
    const files = [...(e.dataTransfer?.files ?? [])];
    if (files.length) this.take(files);
  };

  private onInvalid = (): void => {
    this.touched = true;
    this.setAttribute('data-user-invalid', '');
    this.requestUpdate();
  };
}

define('tr-file-drop', TrFileDrop);

declare global {
  interface HTMLElementTagNameMap {
    'tr-file-drop': TrFileDrop;
  }
}
