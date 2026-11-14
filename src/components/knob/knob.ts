// STUB: replaced by the real implementation.
import { html } from 'lit';
import { TrompeElement, define } from '../../internal/trompe-element.js';

export class TrKnob extends TrompeElement {
  protected override render() {
    return html`<slot></slot>`;
  }
}

define('tr-knob', TrKnob);

declare global {
  interface HTMLElementTagNameMap {
    'tr-knob': TrKnob;
  }
}
