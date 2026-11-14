import { html } from 'lit';
export const view = (vol: number) => html`
  <tr-slider label="Volume" .value=${vol} @input=${() => {}}></tr-slider>
  <tr-button tone=${'accent'} material="plastik">Go</tr-button>
`;
