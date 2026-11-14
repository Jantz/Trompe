<script setup lang="ts">
import { ref } from 'vue';
import type { TrInput, TrKnob, TrSlider, TrSwitch } from 'trompe';

const volume = ref(60);
const gain = ref(40);
const bypass = ref(false);
const taps = ref(0);
const preset = ref('');

// Trompe controls fire native, bubbling input/change/click events; read the element's state.
const onVolume = (e: Event) => (volume.value = (e.target as TrSlider).value);
const onGain = (e: Event) => (gain.value = (e.target as TrKnob).value);
const onBypass = (e: Event) => (bypass.value = (e.target as TrSwitch).checked);
const onPreset = (e: Event) => (preset.value = (e.target as TrInput).value);
</script>

<template>
  <tr-panel screws>
    <h1 slot="header">Trompe + Vue</h1>
    <div class="controls">
      <tr-slider label="Volume" unit="%" :value="volume" @input="onVolume"></tr-slider>
      <div class="row">
        <tr-switch :checked="bypass" @change="onBypass">Bypass</tr-switch>
        <tr-button tone="accent" @click="taps++">Tap</tr-button>
        <tr-input label="Preset" placeholder="Patch name" :value="preset" @input="onPreset"></tr-input>
      </div>
      <tr-knob label="Gain" :value="gain" @input="onGain"></tr-knob>
    </div>
    <dl class="state">
      <dt>volume</dt>
      <dd data-testid="volume">{{ volume }}</dd>
      <dt>gain</dt>
      <dd data-testid="gain">{{ gain }}</dd>
      <dt>bypass</dt>
      <dd data-testid="bypass">{{ bypass ? 'on' : 'off' }}</dd>
      <dt>taps</dt>
      <dd data-testid="taps">{{ taps }}</dd>
      <dt>preset</dt>
      <dd data-testid="preset">{{ preset }}</dd>
    </dl>
  </tr-panel>
</template>
