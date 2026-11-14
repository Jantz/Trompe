import { css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { TrompeElement, define } from '../../internal/trompe-element.js';

let nextId = 0;

/**
 * Content of one tab inside `tr-tabs`. It is shown on the folder surface while its tab is
 * selected and hidden otherwise. Link it to a tab with `name` (matching the tab's `panel`), or
 * leave both unset to pair tabs and panels by order.
 *
 * @summary A tab panel (role="tabpanel") inside tr-tabs.
 * @tag tr-tab-panel
 * @role tabpanel
 *
 * @slot - Panel content.
 *
 * @csspart content - Wrapper around the content.
 *
 * @cssprop --tr-tab-panel-padding - Inner padding. Defaults to 1.25em.
 *
 * @example <tr-tab-panel name="general">General settings…</tr-tab-panel>
 */
export class TrTabPanel extends TrompeElement {
  static override styles = [
    ...TrompeElement.styles,
    css`
      :host {
        display: block;
        outline: none;
      }
      .content {
        padding: var(--tr-tab-panel-padding, 1.25em);
        border-radius: inherit;
      }
      :host(:focus-visible) .content {
        outline: 2px solid var(--tr-color-focus);
        outline-offset: -4px;
        border-radius: var(--tr-radius-sm, 6px);
      }
    `,
  ];

  /** Name a tr-tab refers to with its `panel` attribute. */
  @property({ reflect: true }) name = '';

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'tabpanel');
    if (!this.id) this.id = `tr-tab-panel-${++nextId}`;
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
  }

  protected override render() {
    return html`<div part="content" class="content"><slot></slot></div>`;
  }
}

define('tr-tab-panel', TrTabPanel);

declare global {
  interface HTMLElementTagNameMap {
    'tr-tab-panel': TrTabPanel;
  }
}
