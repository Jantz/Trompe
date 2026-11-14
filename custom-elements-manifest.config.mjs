import { trompePlugin } from './scripts/cem-plugin.mjs';

/** @type {import('@custom-elements-manifest/analyzer').Config} */
export default {
  globs: ['src/**/*.ts'],
  exclude: ['src/generated/**', 'src/**/*.test.ts', 'src/**/*.spec.ts'],
  outdir: '.',
  litelement: true,
  plugins: [trompePlugin()],
};
