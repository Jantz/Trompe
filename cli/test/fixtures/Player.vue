<template>
  <tr-panel>
    <tr-knob :value="gain" label="Gain" @change="onGain" />
    <tr-switch v-model="on" realism="ultra">{{ label }}</tr-switch>
  </tr-panel>
</template>
<script setup lang="ts">
const gain = 3;
</script>
