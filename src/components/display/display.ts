// STUB: replaced by the real implementation.
import { html } from 'lit';
import { TrompeElement, define } from '../../internal/trompe-element.js';

export class TrDisplay extends TrompeElement {
  protected override render() {
    return html`<slot></slot>`;
  }
}

define('tr-display', TrDisplay);

declare global {
  interface HTMLElementTagNameMap {
    'tr-display': TrDisplay;
  }
}
