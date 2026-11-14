/**
 * Trompe: skeuomorphic web components that agents can build and people can feel.
 * Importing this module defines every element and installs the token stylesheet.
 */
export { TrompeElement, installGlobalStyles, define } from './internal/trompe-element.js';
export { FormControl } from './internal/form-control.js';
export { RangeControl } from './internal/range-control.js';
export * from './internal/types.js';
export { materials, finishes, profiles, realismPresets, depthLevels, tokens } from './generated/tokens.js';

export { TrButton } from './components/button/button.js';
export { TrSwitch } from './components/switch/switch.js';
export { TrSlider } from './components/slider/slider.js';
export { TrKnob } from './components/knob/knob.js';
export { TrInput } from './components/input/input.js';
export { TrPanel } from './components/panel/panel.js';
export { TrDisplay } from './components/display/display.js';
export { TrLed } from './components/led/led.js';
export { TrMeter } from './components/meter/meter.js';
