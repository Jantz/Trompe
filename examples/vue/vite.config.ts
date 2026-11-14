import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: './',
  plugins: [
    vue({
      // tr-* are custom elements: render them natively, do not resolve them as Vue components.
      template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('tr-') } },
    }),
  ],
});
