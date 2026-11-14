import { css, html, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';
import { SizeTransition, enter, exit } from '../../interaction/smooth.js';
import type { Orientation, Size } from '../../internal/types.js';
import type { TrTab } from './tab.js';
import type { TrTabPanel } from './tab-panel.js';
// Importing the tabs defines tr-tab and tr-tab-panel too.
import './tab.js';
import './tab-panel.js';

/**
 * A tab set following the WAI-ARIA APG tabs pattern. The default `folder` look is a file folder:
 * the selected tab stands in front, joined to the raised panel surface, while the other tabs sit
 * tucked behind it. The `keys` look is a recessed strip of latching keys above a separate panel.
 *
 * Tabs and panels pair up by order, or by a tab's `panel` attribute matching a panel's `name`.
 * The tab list is one Tab stop; arrow keys move between tabs (Left/Right, or Up/Down when
 * vertical), Home/End jump to the ends. With the default automatic activation, moving focus
 * selects the tab; with `activation="manual"`, Enter or Space selects the focused tab.
 *
 * @summary Tab set (APG tabs) with folder or key-strip styling.
 * @tag tr-tabs
 *
 * @slot - tr-tab-panel elements.
 * @slot tab - tr-tab elements (assigned automatically).
 * @slot actions - Extra content at the far end of the tab strip, such as a tr-button.
 *
 * @csspart base - The outer layout wrapper.
 * @csspart tablist - The tab strip (carries role="tablist").
 * @csspart body - The surface the panels sit on.
 *
 * @cssprop --tr-tabs-radius - Corner radius of the panel surface. Defaults to --tr-radius-lg.
 * @cssprop --tr-tabs-gap - Gap between tabs. Defaults to 0.15em (folder) or 0.3em (keys).
 * @cssprop --tr-tabs-inset - Distance from the folder corner to the first tab. Defaults to 0.75em.
 *
 * @fires change - The selected tab changed by user action. Read `value`.
 *
 * @example <tr-tabs label="Settings"><tr-tab>General</tr-tab><tr-tab>Privacy</tr-tab><tr-tab-panel>…</tr-tab-panel><tr-tab-panel>…</tr-tab-panel></tr-tabs>
 * @example <tr-tabs variant="keys" value="audio"><tr-tab panel="video">Video</tr-tab><tr-tab panel="audio">Audio</tr-tab><tr-tab-panel name="video">…</tr-tab-panel><tr-tab-panel name="audio">…</tr-tab-panel></tr-tabs>
 * @example <tr-tabs orientation="vertical" activation="manual">…</tr-tabs>
 */
export class TrTabs extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        --_radius: var(--tr-tabs-radius, var(--tr-radius-lg, 16px));
        --_inset: var(--tr-tabs-inset, 0.75em);
        display: block;
        font-size: var(--tr-font-size-md, 1em);
      }
      :host([size='sm']) {
        font-size: var(--tr-font-size-sm, 0.875em);
      }
      :host([size='lg']) {
        font-size: var(--tr-font-size-lg, 1.125em);
      }
      .base {
        display: flex;
        flex-direction: column;
      }
      .strip {
        display: flex;
        align-items: flex-end;
        gap: 0.5em;
        min-width: 0;
      }
      .tablist {
        display: flex;
        align-items: flex-end;
        gap: var(--tr-tabs-gap, 0.15em);
        min-width: 0;
        overflow-x: auto;
        scrollbar-width: none;
        flex: 0 1 auto;
      }
      .actions {
        margin-inline-start: auto;
        align-self: center;
        display: flex;
        gap: 0.5em;
      }
      .actions:not(.has) {
        display: none;
      }
      /* Panels cross-fade: the leaving one is lifted out of flow while it fades, and the folder
         glides to the new panel's height (SizeTransition) instead of jumping. */
      .panes {
        position: relative;
        display: flow-root;
        flex: 1 1 auto;
      }
      /* .clip and .panes pass the folder's size through, so a panel can still fill it (height: 100%) */
      .clip {
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      ::slotted([data-tr-leaving]) {
        position: absolute !important;
        inset: 0 0 auto 0;
        pointer-events: none;
      }
      .body {
        --_tr-z: 1;
        /* a broad content surface: tame clear-coat and mirror reflections so text stays legible */
        --_gloss: calc(var(--tr-f-gloss, var(--tr-m-gloss, 0)) * 0.3);
        --_mirror: calc(var(--tr-f-mirror, var(--tr-m-mirror, 0)) * 0.3);
        z-index: 1;
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        border-radius: var(--_radius);
      }
      /* folder: the first tab grows straight out of the folder's square corner */
      :host([variant='folder']) .tablist {
        /* the strip scrolls when it overflows, so it reaches down over the folder's top edge
           (tucked tabs go behind the folder, the selected tab in front) instead of clipping */
        padding: 0.4em var(--_inset) 0.5em;
        margin-bottom: calc(-0.5em - 1px);
      }
      :host([variant='folder']) .actions {
        margin-bottom: 0.5em;
      }

      /* keys: a recessed strip of latching keys above the panel */
      :host([variant='keys']) .base {
        gap: 0.75em;
      }
      :host([variant='keys']) .tablist {
        --_tr-z: -1;
        --_base: var(--tr-color-well);
        gap: var(--tr-tabs-gap, 0.3em);
        padding: 0.3em;
        border-radius: calc(var(--tr-radius-md, 10px) * 0.7 + 0.3em);
        align-items: stretch;
        overflow: visible;
      }

      /* vertical: tabs on the start side */
      :host([orientation='vertical']) .base {
        flex-direction: row;
      }
      :host([orientation='vertical']) .strip {
        flex-direction: column;
        align-items: stretch;
      }
      :host([orientation='vertical']) .tablist {
        flex-direction: column;
        align-items: stretch;
        overflow: visible;
      }
      :host([orientation='vertical'][variant='folder']) .tablist {
        padding: var(--_inset) 0.5em var(--_inset) 0.4em;
        margin: 0 calc(-0.5em - 1px) 0 0;
      }
      :host([orientation='vertical']) .actions {
        margin: auto 0 0;
        align-self: stretch;
        flex-direction: column;
      }
      :host([orientation='vertical'][variant='keys']) .base {
        gap: 0.75em;
      }
      @media (forced-colors: active) {
        .body {
          border: 1px solid CanvasText;
        }
      }
    `,
  ];

  /** Accessible name of the tab list. */
  @property() label = '';

  /** Layout of the tab strip. */
  @property({ reflect: true }) orientation: Orientation = 'horizontal';

  /** Whether focusing a tab selects it (automatic) or Enter/Space is needed (manual). */
  @property({ reflect: true }) activation: 'automatic' | 'manual' = 'automatic';

  /** Look of the tabs: file-folder tabs joined to the panel, or a strip of latching keys. */
  @property({ reflect: true }) variant: 'folder' | 'keys' = 'folder';

  /** Size of the tabs. */
  @property({ reflect: true }) size: Size = 'md';

  /**
   * Identifies the selected tab: its `panel` attribute, or its zero-based index as a string when
   * it has none. Set it to select a tab.
   */
  @property({ reflect: true }) value = '';

  private hasActions = false;
  /** Panel switches animate once the tabs have been on screen (not on first render). */
  private live = false;
  /** Panels that have been on screen: only these fade out; any other panel hides at once. */
  private seen = new WeakSet<TrTabPanel>();
  protected readonly bodySize = new SizeTransition(this, () => ({
    outer: this.renderRoot?.querySelector<HTMLElement>('.clip'),
    inner: this.renderRoot?.querySelector<HTMLElement>('.panes'),
  }), { pin: false });

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    requestAnimationFrame(() => (this.live = true));
  }

  constructor() {
    super();
    this.addEventListener('keydown', this.onKeyDown);
    this.addEventListener('click', this.onClick);
  }

  /** The tr-tab children, in order. */
  get tabs(): TrTab[] {
    return [...this.children].filter((el): el is TrTab => el.localName === 'tr-tab');
  }

  /** The tr-tab-panel children, in order. */
  get panels(): TrTabPanel[] {
    return [...this.children].filter((el): el is TrTabPanel => el.localName === 'tr-tab-panel');
  }

  protected override render() {
    return html`<div part="base" class="base">
      <div class="strip">
        <div
          part="tablist"
          class="tablist ${this.variant === 'keys' ? 'surface' : ''}"
          role="tablist"
          aria-label=${this.label || this.getAttribute('aria-label') || 'Tabs'}
          aria-orientation=${this.orientation}
        >
          <slot name="tab" @slotchange=${this.sync}></slot>
        </div>
        <div class="actions ${this.hasActions ? 'has' : ''}"><slot name="actions" @slotchange=${this.onActions}></slot></div>
      </div>
      <div part="body" class="body surface"><div class="clip"><div class="panes"><slot @slotchange=${this.sync}></slot></div></div></div>
    </div>`;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('value') || changed.has('variant') || changed.has('orientation')) this.sync();
  }

  private onActions(e: Event): void {
    this.hasActions = (e.target as HTMLSlotElement).assignedElements().length > 0;
    this.requestUpdate();
  }

  private keyOf(tab: TrTab, index: number): string {
    return tab.panel || String(index);
  }

  private panelFor(tab: TrTab, index: number): TrTabPanel | undefined {
    const panels = this.panels;
    if (tab.panel) return panels.find((p) => p.name === tab.panel);
    return panels[index];
  }

  /** Index of the tab that should be selected, from `value`, a `selected` tab, or the first enabled tab. */
  private resolveIndex(tabs: TrTab[]): number {
    let index = this.value ? tabs.findIndex((t, i) => this.keyOf(t, i) === this.value) : -1;
    if (index < 0 || tabs[index]!.disabled) index = tabs.findIndex((t) => t.selected && !t.disabled);
    if (index < 0) index = tabs.findIndex((t) => !t.disabled);
    return Math.max(0, index);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const tabs = this.tabs;
    if (tabs.length) {
      const i = this.resolveIndex(tabs);
      this.value = this.keyOf(tabs[i]!, i);
    }
  }

  /** Applies the selection, roving tabindex and ARIA links to every tab and panel. */
  private sync = (): void => {
    const tabs = this.tabs;
    if (!tabs.length) return;
    const index = this.resolveIndex(tabs);
    const key = this.keyOf(tabs[index]!, index);
    if (this.value !== key) this.value = key;
    const shown = new Set<TrTabPanel>();
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.selected = on;
      tab.setAttribute('tabindex', on ? '0' : '-1');
      tab.dataset.variant = this.variant;
      tab.dataset.orientation = this.orientation;
      const panel = this.panelFor(tab, i);
      if (panel) {
        tab.setAttribute('aria-controls', panel.id);
        panel.setAttribute('aria-labelledby', tab.id);
        if (on) shown.add(panel);
      } else {
        tab.removeAttribute('aria-controls');
      }
    });
    // The folder glides to the new panel's height; between switches it sizes itself, so a
    // panel can still fill it.
    if (this.live) this.bodySize.hold();
    for (const panel of this.panels) this.showPanel(panel, shown.has(panel));
  };

  /** Shows or hides a panel, cross-fading when the tabs are already on screen. */
  private showPanel(panel: TrTabPanel, show: boolean): void {
    const leaving = panel.hasAttribute('data-tr-leaving');
    if (show) {
      if (!panel.hidden && !leaving) {
        this.seen.add(panel);
        return;
      }
      panel.hidden = false;
      panel.removeAttribute('data-tr-leaving');
      panel.removeAttribute('aria-hidden');
      panel.inert = false;
      if (this.live) enter(panel, { y: 0, duration: 200 });
      this.seen.add(panel);
      return;
    }
    if (panel.hidden || leaving) return;
    if (!this.live || !this.seen.has(panel)) {
      panel.hidden = true;
      return;
    }
    // Leaving: still painted while it fades, but already gone for focus and assistive tech.
    panel.setAttribute('data-tr-leaving', '');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
    void exit(panel, { y: 0, duration: 140 }).then((done) => {
      if (!panel.hasAttribute('data-tr-leaving')) return;
      panel.removeAttribute('data-tr-leaving');
      panel.removeAttribute('aria-hidden');
      panel.inert = false;
      if (done) panel.hidden = true;
    });
  }

  private select(tab: TrTab, focus: boolean): void {
    const tabs = this.tabs;
    const i = tabs.indexOf(tab);
    if (i < 0 || tab.disabled) return;
    if (focus) tab.focus();
    const key = this.keyOf(tab, i);
    if (key === this.value && tab.selected) return;
    this.value = key;
    this.sync();
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  private onClick = (e: MouseEvent): void => {
    const tab = (e.target as Element).closest?.('tr-tab') as TrTab | null;
    if (!tab || tab.parentElement !== this) return;
    this.select(tab, true);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const tab = (e.target as Element).closest?.('tr-tab') as TrTab | null;
    if (!tab || tab.parentElement !== this) return;
    const vertical = this.orientation === 'vertical';
    const rtl = getComputedStyle(this).direction === 'rtl';
    const next = vertical ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';
    const prev = vertical ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';
    const enabled = this.tabs.filter((t) => !t.disabled);
    if (!enabled.length) return;
    let at = enabled.indexOf(tab);
    let target: TrTab | undefined;
    switch (e.key) {
      case next:
        target = enabled[(at + 1) % enabled.length];
        break;
      case prev:
        if (at < 0) at = 0;
        target = enabled[(at - 1 + enabled.length) % enabled.length];
        break;
      case 'Home':
        target = enabled[0];
        break;
      case 'End':
        target = enabled[enabled.length - 1];
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.select(tab, false);
        return;
      default:
        return;
    }
    e.preventDefault();
    if (!target) return;
    if (this.activation === 'automatic') {
      this.select(target, true);
    } else {
      // manual: roving focus only, selection waits for Enter/Space
      for (const t of this.tabs) t.setAttribute('tabindex', t === target ? '0' : '-1');
      target.focus();
    }
  };

  override focus(options?: FocusOptions): void {
    const tab = this.tabs.find((t) => t.getAttribute('tabindex') === '0');
    if (tab) tab.focus(options);
    else super.focus(options);
  }
}

define('tr-tabs', TrTabs);

declare global {
  interface HTMLElementTagNameMap {
    'tr-tabs': TrTabs;
  }
}
