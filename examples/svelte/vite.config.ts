import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Svelte treats any tag with a dash as a custom element: no extra configuration needed.
export default defineConfig({
  base: './',
  plugins: [svelte()],
});
