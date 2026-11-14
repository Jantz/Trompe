// STUB: replaced by the real implementation.
import { html } from 'lit';
import { TrompeElement, define } from '../../internal/trompe-element.js';

export class TrLed extends TrompeElement {
  protected override render() {
    return html`<slot></slot>`;
  }
}

define('tr-led', TrLed);

declare global {
  interface HTMLElementTagNameMap {
    'tr-led': TrLed;
  }
}
