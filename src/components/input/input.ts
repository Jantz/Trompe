// STUB: replaced by the real implementation.
import { html } from 'lit';
import { TrompeElement, define } from '../../internal/trompe-element.js';

export class TrInput extends TrompeElement {
  protected override render() {
    return html`<slot></slot>`;
  }
}

define('tr-input', TrInput);

declare global {
  interface HTMLElementTagNameMap {
    'tr-input': TrInput;
  }
}
