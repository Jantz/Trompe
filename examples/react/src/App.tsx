import { useState } from 'react';
// Typed JSX for every tr-* element, generated from custom-elements.json.
import type {} from 'trompe/frameworks/react';

export function App() {
  const [volume, setVolume] = useState(60);
  const [gain, setGain] = useState(40);
  const [bypass, setBypass] = useState(false);
  const [taps, setTaps] = useState(0);
  const [preset, setPreset] = useState('');

  // React 19 sets value/checked as DOM properties and wires onInput/onChange/onClick to the
  // elements' native bubbling events.
  return (
    <tr-panel screws>
      <h1 slot="header">Trompe + React</h1>
      <div className="controls">
        <tr-slider label="Volume" unit="%" value={volume} onInput={(e) => setVolume(e.currentTarget.value)} />
        <div className="row">
          <tr-switch checked={bypass} onChange={(e) => setBypass(e.currentTarget.checked)}>
            Bypass
          </tr-switch>
          <tr-button tone="accent" onClick={() => setTaps((n) => n + 1)}>
            Tap
          </tr-button>
          <tr-input label="Preset" placeholder="Patch name" value={preset} onInput={(e) => setPreset(e.currentTarget.value)} />
        </div>
        <tr-knob label="Gain" value={gain} onInput={(e) => setGain(e.currentTarget.value)} />
      </div>
      <dl className="state">
        <dt>volume</dt>
        <dd data-testid="volume">{volume}</dd>
        <dt>gain</dt>
        <dd data-testid="gain">{gain}</dd>
        <dt>bypass</dt>
        <dd data-testid="bypass">{bypass ? 'on' : 'off'}</dd>
        <dt>taps</dt>
        <dd data-testid="taps">{taps}</dd>
        <dt>preset</dt>
        <dd data-testid="preset">{preset}</dd>
      </dl>
    </tr-panel>
  );
}
