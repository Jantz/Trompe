// STUB: replaced by the real implementation.
import { html } from 'lit';
import { TrompeElement, define } from '../../internal/trompe-element.js';

export class TrMeter extends TrompeElement {
  protected override render() {
    return html`<slot></slot>`;
  }
}

define('tr-meter', TrMeter);

declare global {
  interface HTMLElementTagNameMap {
    'tr-meter': TrMeter;
  }
}
