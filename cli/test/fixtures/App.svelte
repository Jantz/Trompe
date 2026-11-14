<script lang="ts">
  let v = $state(0);
  const a = (e: Event) => v > 2;
</script>
<tr-slider label="Exposure" min={-100} max={100} oninput={(e: Event) => (v = 1)} {...rest}></tr-slider>
<tr-progress value={v} max={4} label={`Step ${v} of 4 steps complete`}></tr-progress>
<tr-panel depth={2} class="a {b ? 'c' : ''}">
  {#if v > 1}<tr-button>{name}</tr-button>{:else}<tr-button tone="primary">Go</tr-button>{/if}
</tr-panel>
<style>.a > b { color: red }</style>
