// STUB: replaced by the real implementation.
import { html } from 'lit';
import { TrompeElement, define } from '../../internal/trompe-element.js';

export class TrPanel extends TrompeElement {
  protected override render() {
    return html`<slot></slot>`;
  }
}

define('tr-panel', TrPanel);

declare global {
  interface HTMLElementTagNameMap {
    'tr-panel': TrPanel;
  }
}
