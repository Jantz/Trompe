import { css, html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';

/** Stable hue for a name, so the same person always gets the same enamel colour. */
function hueOf(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.codePointAt(0)!) % 3607;
  return (h * 47) % 360;
}

/** "Ada Lovelace" -> "AL", "grace" -> "G", "Mary-Jane O'Neil" -> "MO". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const first = [...words[0]][0] ?? '';
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * A person or team, as a photo set into a bezel or as initials on a domed enamel token. Each name
 * gets its own stable enamel colour (`tone="auto"`), lit by the scene light like every surface.
 * An optional status lamp sits on the rim.
 *
 * It has role="img" and is named by `name` (plus the status), so screen readers hear "Ada
 * Lovelace, online". When the name is already written next to it, add `decorative` so it is not
 * read twice. A broken `src` falls back to the initials.
 *
 * @summary Avatar: photo or initials on an enamel token, with an optional status lamp.
 * @tag tr-avatar
 * @role img
 *
 * @slot - Optional custom content (an icon) instead of initials.
 *
 * @csspart avatar - The token surface.
 * @csspart image - The photo.
 * @csspart initials - The initials text.
 * @csspart status - The status lamp.
 *
 * @cssprop --tr-avatar-size - Diameter. Defaults by `size` (1.5em, 2em, 2.5em, 3.25em, 4.5em).
 * @cssprop --tr-avatar-color - Enamel colour. Defaults to a hue derived from `name` (`tone="auto"`).
 * @cssprop --tr-avatar-ink - Initials colour.
 * @cssprop --tr-avatar-radius - Corner radius for `shape="rounded"`. Defaults to --tr-radius-md.
 *
 * @example <tr-avatar name="Ada Lovelace"></tr-avatar>
 * @example <tr-avatar name="Grace Hopper" src="/people/grace.jpg" status="online" size="lg"></tr-avatar>
 * @example <tr-avatar name="Design team" shape="rounded" tone="accent"></tr-avatar>
 * @example <tr-list-item><tr-avatar slot="start" name="Linus Pauling" decorative></tr-avatar>Linus Pauling</tr-list-item>
 */
export class TrAvatar extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_size: var(--tr-avatar-size, 2.5em);
        --_hue: 250;
        --_tone: var(--tr-avatar-color, oklch(from var(--tr-color-accent) clamp(0.55, l, 0.7) clamp(0.07, c, 0.12) var(--_hue)));
        --_tone-ink: var(--tr-avatar-ink, oklch(from var(--_tone) 0.985 0.01 h));
        display: inline-block;
        position: relative;
        flex: none;
        width: var(--_size);
        height: var(--_size);
        vertical-align: middle;
        line-height: 1;
      }
      :host([size='xs']) { --_size: var(--tr-avatar-size, 1.5em); }
      :host([size='sm']) { --_size: var(--tr-avatar-size, 2em); }
      :host([size='lg']) { --_size: var(--tr-avatar-size, 3.25em); }
      :host([size='xl']) { --_size: var(--tr-avatar-size, 4.5em); }
      :host([tone='accent']) {
        --_tone: var(--tr-avatar-color, var(--tr-color-accent));
        --_tone-ink: var(--tr-avatar-ink, var(--tr-color-accent-ink));
      }
      :host([tone='neutral']) {
        --_tone: var(--tr-avatar-color, var(--_m-base));
        --_tone-ink: var(--tr-avatar-ink, var(--_m-ink));
      }
      .avatar {
        --_tr-z: 1;
        --_base: var(--_tone);
        --_ink: var(--_tone-ink);
        --_edge: color-mix(in oklch, var(--_tone), var(--_sh) 35%);
        /* domed enamel: a clear-coat over a pillowed face */
        --_gloss: max(var(--tr-f-gloss, var(--tr-m-gloss, 0)), 0.5);
        --_curve: 0.55;
        display: grid;
        place-items: center;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        overflow: hidden;
        font-size: calc(var(--_size) * 0.38);
        font-weight: var(--tr-font-weight-strong, 600);
        letter-spacing: 0.02em;
        user-select: none;
        transition: --_tr-z var(--tr-motion-duration-release, 160ms) var(--tr-motion-easing-settle, ease-out);
      }
      .avatar > * {
        grid-area: 1 / 1;
      }
      :host([shape='rounded']) .avatar {
        border-radius: var(--tr-avatar-radius, var(--tr-radius-md, 10px));
      }
      /* a photo is set into a thin bezel of the surrounding material */
      .avatar.photo {
        --_base: var(--_m-base);
        --_gloss: 0;
        --_curve: 0;
        padding: max(1.5px, calc(var(--_size) * 0.045));
      }
      img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: inherit;
        /* the photo sits behind glass in the bezel: a faint inner shade on the side away from the light */
        box-shadow: inset calc(var(--_sx) * 1.5px) calc(var(--_sy) * 1.5px) 3px color-mix(in oklch, var(--_sh) calc(var(--_r) * 35%), transparent);
        opacity: 0;
        transition: opacity var(--tr-motion-duration-lift, 240ms) ease-out;
      }
      img.loaded {
        opacity: 1;
      }
      .initials {
        position: relative;
        text-shadow: 0 calc(var(--_sy) * -1px) 0 color-mix(in oklch, var(--_sh) calc(var(--_r) * 25%), transparent);
      }
      ::slotted(svg) {
        width: 55%;
        height: 55%;
      }
      .status {
        position: absolute;
        right: calc(var(--_size) * 0.02);
        bottom: calc(var(--_size) * 0.02);
        width: max(0.55em, calc(var(--_size) * 0.28));
        height: max(0.55em, calc(var(--_size) * 0.28));
        border-radius: 50%;
        --_lamp: var(--tr-color-success, oklch(68% 0.16 150));
        background: radial-gradient(circle at 35% 30%, color-mix(in oklch, white 65%, var(--_lamp)), var(--_lamp) 55%, color-mix(in oklch, var(--_lamp), black 25%));
        box-shadow:
          0 0 0 max(1.5px, calc(var(--_size) * 0.04)) var(--tr-color-surface, #fff),
          0 0 calc(2px + var(--_r) * 5px) color-mix(in oklch, var(--_lamp) 75%, transparent);
        transition:
          --_lamp var(--tr-motion-duration-release, 160ms) ease-out,
          box-shadow var(--tr-motion-duration-release, 160ms) ease-out,
          scale var(--tr-motion-duration-travel, 220ms) var(--tr-motion-easing-spring, ease-out);
      }
      @starting-style {
        .status {
          scale: 0;
        }
      }
      .status[data-status='away'] { --_lamp: var(--tr-color-warning, oklch(80% 0.15 80)); }
      .status[data-status='busy'] { --_lamp: var(--tr-color-danger, oklch(60% 0.2 25)); }
      /* an unlit lamp: grey, no glow (same gradient, so the change fades) */
      .status[data-status='offline'] {
        --_lamp: color-mix(in oklch, var(--tr-color-ink-muted, #888) 50%, var(--tr-color-surface, #fff));
        box-shadow:
          0 0 0 max(1.5px, calc(var(--_size) * 0.04)) var(--tr-color-surface, #fff),
          0 0 0 transparent;
      }
      @media (forced-colors: active) {
        .avatar {
          border: 1px solid CanvasText;
        }
        .status {
          forced-color-adjust: none;
          background: CanvasText;
        }
      }
    `,
  ];

  /** The person's or team's name: the accessible name and the source of the initials and colour. */
  @property({ reflect: true }) name = '';

  /** Photo URL. Falls back to the initials while loading and when it fails. */
  @property({ reflect: true }) src = '';

  /** Diameter. */
  @property({ reflect: true }) size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';

  /** Circle (people) or rounded square (teams, workspaces). */
  @property({ reflect: true }) shape: 'circle' | 'rounded' = 'circle';

  /** Enamel colour: `auto` derives a stable hue from the name. */
  @property({ reflect: true }) tone: 'auto' | 'accent' | 'neutral' = 'auto';

  /** Presence lamp on the rim. Also read out after the name. */
  @property({ reflect: true }) status: '' | 'online' | 'away' | 'busy' | 'offline' = '';

  /** Hide it from assistive technology, when the name is written next to it. */
  @property({ type: Boolean, reflect: true }) decorative = false;

  @state() private loaded = false;
  @state() private failed = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncA11y();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('src')) {
      this.loaded = false;
      this.failed = false;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('name')) this.style.setProperty('--_hue', String(hueOf(this.name || '?')));
    if (changed.has('name') || changed.has('status') || changed.has('decorative')) this.syncA11y();
  }

  private syncA11y(): void {
    if (this.decorative) {
      this.removeAttribute('role');
      this.setAttribute('aria-hidden', 'true');
      return;
    }
    if (this.getAttribute('aria-hidden') === 'true') this.removeAttribute('aria-hidden');
    this.setAttribute('role', 'img');
    if (!this.hasAttribute('aria-labelledby')) this.setAttribute('aria-label', [this.name || 'Avatar', this.status].filter(Boolean).join(', '));
  }

  protected override render() {
    const photo = this.src && !this.failed;
    return html`<span part="avatar" class="avatar surface ${photo && this.loaded ? 'photo' : ''}">
        ${photo
          ? html`<img
              part="image"
              class=${this.loaded ? 'loaded' : ''}
              src=${this.src}
              alt=""
              @load=${() => (this.loaded = true)}
              @error=${() => (this.failed = true)}
            />`
          : nothing}
        ${photo && this.loaded ? nothing : html`<span part="initials" class="initials" aria-hidden="true"><slot>${initialsOf(this.name)}</slot></span>`}
      </span>
      ${this.status ? html`<span part="status" class="status" data-status=${this.status}></span>` : nothing}`;
  }
}

define('tr-avatar', TrAvatar);

declare global {
  interface HTMLElementTagNameMap {
    'tr-avatar': TrAvatar;
  }
}
