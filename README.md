# Trompe

Skeuomorphic UI that agents can build, and people can feel.

Trompe is a framework-independent library of web components for everyday interfaces (buttons, fields, selects, tabs, dialogs, menus, navigation, lists) rendered with real materials: satin and glossy plastic, brushed aluminium, polished chrome, rubber, paper and frosted glass. It spans subtle tactile depth to full material realism with one dial, and it is built so a coding agent can find, assemble, theme and check a complete interface from a plain-language description.

- **One physical model.** Every surface is computed in CSS from one light (angle and height), a depth level, a realism dial and a handful of material parameters. Move the light and the whole page re-lights consistently. No images.
- **Composable, not one style.** Materials, finishes and profiles are independent parameter bundles. Skins combine them into complete looks, and you can write your own as JSON.
- **Works everywhere.** Standard custom elements built with Lit. Plain HTML, React 19, Vue 3, Svelte 5 and anything else that renders DOM. Native `input` and `change` events, form association, real ARIA.
- **Made for agents.** Predictable names, strict TypeScript types, and machine-readable docs in the package: `custom-elements.json`, `tokens.json`, `skins.json`, `llms.txt` and `llms-full.txt`, plus typed JSX/Vue/Svelte declarations generated from the manifest.

## Quick start

```html
<script type="module" src="https://unpkg.com/trompe/dist/trompe.bundle.js"></script>
<link rel="stylesheet" href="https://unpkg.com/trompe/dist/skins.css" />

<body data-tr-skin="soft">
  <tr-panel>
    <tr-input label="Email" type="email" required></tr-input>
    <tr-switch checked>Two-factor sign-in</tr-switch>
    <tr-button tone="accent">Save</tr-button>
  </tr-panel>
</body>
```

With a bundler:

```js
import 'trompe'; // defines every element and installs the token stylesheet
import 'trompe/skins.css'; // optional: the bundled skins
// or one component at a time
import 'trompe/components/button';
```

## The model

| Input | How to set it | Values |
| --- | --- | --- |
| Light | `--tr-light-angle`, `--tr-light-elevation` on any element | angle the light comes from (0deg = top, clockwise), height above the surface |
| Realism | `realism` attribute, `data-tr-realism` on a container, or `--tr-realism` | `flat`, `soft`, `tactile` (default), `real`, or any number 0..1 |
| Depth | `depth` attribute | `-2` well, `-1` pressed, `0` flush, `1` raised, `2` lifted, `3` floating, `4` overlay |
| Material | `material` attribute or `data-tr-material` | `plastic`, `metal`, `chrome`, `glass`, `paper`, `rubber` |
| Finish | `finish` attribute or `data-tr-finish` | `matte`, `satin`, `gloss`, `mirror`, `brushed`, `spun` |
| Profile | `profile` attribute or `data-tr-profile` | `flat`, `convex`, `concave`, `dome`, `bevel` |
| Theme | `data-tr-theme` on any element | `light`, `dark` (default follows the system) |
| Skin | `data-tr-skin` on any element | `soft`, `studio`, `chrome`, `heritage`, `aurora` |

Every material, finish and profile parameter is also a CSS variable (`--tr-m-*`, `--tr-f-*`, `--tr-p-*`), so a custom material is just a few declarations. The whole interface scales with `font-size`.

All tokens are authored once in [`tokens/trompe.tokens.json`](tokens/trompe.tokens.json) (W3C Design Tokens format) and built to CSS custom properties. Skins live in [`skins/`](skins/) as JSON.

## Components

Core: `tr-button`, `tr-input`, `tr-textarea`, `tr-checkbox`, `tr-radio-group` + `tr-radio`, `tr-switch`, `tr-select` + `tr-option`, `tr-segmented`, `tr-slider`, `tr-tabs` + `tr-tab` + `tr-tab-panel`, `tr-panel`, `tr-dialog`, `tr-menu` + `tr-menu-item`, `tr-tooltip`, `tr-progress`, `tr-badge`, `tr-toolbar`, `tr-nav` + `tr-nav-item`, `tr-list` + `tr-list-item`.

Extras for instrument-like interfaces: `tr-knob`, `tr-display` (LCD, VFD, LED and OLED, with segment and dot-matrix glyphs), `tr-led`, `tr-meter`.

Run `npm run build` and read `llms.txt` for every attribute, allowed value, event, slot, part and CSS property.

## Accessibility

Every interactive control follows the WAI-ARIA Authoring Practices pattern for its role, is keyboard operable, and carries real ARIA attributes. State is never shown by depth or color alone. Controls keep a 3:1 boundary, grow to 44px touch targets on coarse pointers, and have defined fallbacks for forced colors, reduced motion, reduced transparency (glass becomes opaque) and increased contrast (realism is capped).

## Development

```sh
npm install
npm run dev        # showcase at /showcase/
npm test           # Playwright: behaviour, axe and visual snapshots
npm run build      # dist/, bundle, custom-elements.json, llms.txt, framework types
npm run test:frameworks  # React, Vue, Svelte and plain HTML smoke tests
```

Generated files (`src/generated/`, `dist/`, `custom-elements.json`, `llms*.txt`) are not committed. Edit `tokens/trompe.tokens.json` and `skins/*.skin.json`, then `npm run tokens`.

## License

MIT
