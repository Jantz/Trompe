<script lang="ts">
  let volume = $state(60);
  let gain = $state(40);
  let bypass = $state(false);
  let taps = $state(0);
  let preset = $state('');

  // Svelte sets value/checked as DOM properties; Trompe controls fire native, bubbling
  // input/change/click events with the element as currentTarget.
</script>

<tr-panel screws>
  <h1 slot="header">Trompe + Svelte</h1>
  <div class="controls">
    <tr-slider label="Volume" unit="%" value={volume} oninput={(e) => (volume = e.currentTarget.value)}></tr-slider>
    <div class="row">
      <tr-switch checked={bypass} onchange={(e) => (bypass = e.currentTarget.checked)}>Bypass</tr-switch>
      <!-- tr-button gives itself role="button" and fires click on Enter/Space, which Svelte's lint cannot see. -->
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <tr-button tone="accent" onclick={() => taps++}>Tap</tr-button>
      <tr-input label="Preset" placeholder="Patch name" value={preset} oninput={(e) => (preset = e.currentTarget.value)}></tr-input>
    </div>
    <tr-knob label="Gain" value={gain} oninput={(e) => (gain = e.currentTarget.value)}></tr-knob>
  </div>
  <dl class="state">
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
