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

**Building an app (React, Vue, Svelte or plain HTML)?** Start with [docs/guide.md](docs/guide.md)
(`node_modules/trompe/docs/guide.md`): framework setup, page setup, which element for which need,
how to make it look professional, skins from a description, and checking. Agents: `llms.txt` in the
package has the same guide plus every element, attribute and token.

## The model

| Input | How to set it | Values |
| --- | --- | --- |
| Light | `--tr-light-angle`, `--tr-light-elevation` on any element | angle the light comes from (0deg = top, clockwise), height above the surface |
| Realism | `realism` attribute or `data-tr-realism` on a container (presets), or `--tr-realism` (any number 0..1) | `flat`, `soft`, `tactile` (default), `real`; for an in-between value set `--tr-realism: 0.5` in CSS |
| Depth | `depth` attribute | `-2` well, `-1` pressed, `0` flush, `1` raised, `2` lifted, `3` floating, `4` overlay |
| Material | `material` attribute or `data-tr-material` | `plastic`, `metal`, `chrome`, `glass`, `paper`, `rubber` |
| Finish | `finish` attribute or `data-tr-finish` | `matte`, `satin`, `gloss`, `mirror`, `brushed`, `spun` |
| Profile | `profile` attribute or `data-tr-profile` | `flat`, `convex`, `concave`, `dome`, `bevel` |
| Theme | `data-tr-theme` on any element | `light`, `dark` (default follows the system) |
| Skin | `data-tr-skin` on any element | `soft`, `studio`, `chrome`, `heritage`, `aurora` |

Every material, finish and profile parameter is also a CSS variable (`--tr-m-*`, `--tr-f-*`, `--tr-p-*`), so a custom material is just a few declarations. The whole interface scales with `font-size`.

All tokens are authored once in `tokens/trompe.tokens.json` in the repository (W3C Design Tokens format) and built to CSS custom properties; the package ships them as `trompe/tokens.json` and `trompe/tokens.css`. Skins are JSON (`trompe/skins.json`).

## Make your own skin

Compose a skin in **Trompe Studio** (in the repository: `npm run dev:studio`): describe a look in plain words or start
from a skin, then tune light, colour, real-world materials (walnut, brass, leather, ceramic, felt,
glass and two dozen more, with procedural textures lit by the skin's own light), shape, type and
motion against live app screens. Export skin JSON, CSS or a brief for agents.

Agents get the same engine without a UI:

```sh
npx trompe skin "walnut panels with brushed brass knobs, amber accent, low evening light" --name library --out skins/library.skin.json --css library.css
```

```js
import { skinFromDescription, validateSkin, applySkin } from 'trompe/skin';
```

See [docs/skins.md](docs/skins.md) and [docs/studio.md](docs/studio.md).

## Components

Core: `tr-button`, `tr-input`, `tr-textarea`, `tr-number-field`, `tr-checkbox`, `tr-radio-group` + `tr-radio`, `tr-switch`, `tr-select` + `tr-option`, `tr-segmented`, `tr-slider`, `tr-tabs` + `tr-tab` + `tr-tab-panel`, `tr-panel`, `tr-table`, `tr-dialog`, `tr-menu` + `tr-menu-item`, `tr-tooltip`, `tr-toast` + `tr-toaster` (and the `toast()` helper), `tr-avatar`, `tr-icon`, `tr-chart`, `tr-date-picker` + `tr-calendar`, `tr-choice-group` + `tr-choice-card`, `tr-pagination`, `tr-range-slider`, `tr-chip-group` + `tr-chip`, `tr-stepper` + `tr-step`, `tr-file-drop`, `tr-progress`, `tr-badge`, `tr-toolbar`, `tr-nav` + `tr-nav-item`, `tr-list` + `tr-list-item`.

Extras for instrument-like interfaces: `tr-knob`, `tr-display` (LCD, VFD, LED and OLED, with segment and dot-matrix glyphs), `tr-led`, `tr-meter`.

`llms.txt` in the package lists every attribute, allowed value, event, slot, part and CSS property.

## Checking your markup

```sh
npx trompe check src/            # .html, .vue, .svelte, .jsx/.tsx, Lit html``, .css and *.skin.json
npx trompe check --fix src/      # fix typos in element, attribute and value names
npx trompe check --render dist/index.html --format json   # + axe, contrast, target size, forced colours, motion
```

`trompe check` reads the package's own `custom-elements.json`, `tokens.json` and `skins.json`, so it always matches the installed version. It is built for agents: JSON findings with stable rule ids, the allowed values and a fix. See [docs/check.md](docs/check.md).

## Motion

Every state change animates and nothing jumps: menus, dialogs and tooltips enter and leave, tab panels and messages animate their height, list rows open and close into place, changed text cross-fades, and theme or skin changes run as View Transitions. The same primitives (`SizeTransition`, `insertAnimated`, `crossfadeText`, `viewTransition`, ...) are exported for your own code. A motion probe freezes the page on the first frame after each change and fails the tests, or `trompe check --render`, when something cut, jumped or popped. See [docs/motion.md](docs/motion.md).

## Accessibility

Every interactive control follows the WAI-ARIA Authoring Practices pattern for its role, is keyboard operable, and carries real ARIA attributes. State is never shown by depth or color alone. Controls keep a 3:1 boundary, grow to 44px touch targets on coarse pointers, and have defined fallbacks for forced colors, reduced motion, reduced transparency (glass becomes opaque) and increased contrast (realism is capped).

## Development

```sh
npm install
npm run dev        # showcase at /showcase/
npm run dev:studio # Trompe Studio at /studio/ (npm run build:studio for one self-contained file)
npm test           # Playwright: behaviour, axe and visual snapshots
npm run build      # dist/, bundle, custom-elements.json, llms.txt, framework types
npm run test:frameworks  # React, Vue, Svelte and plain HTML smoke tests
npm run test:unit  # skin engine and interaction physics
npm run test:check # trompe check and trompe skin (after npm run build)
npm run check -- showcase skins  # run the checker on the repo itself
```

Visual snapshots are rendered in the pinned `mcr.microsoft.com/playwright:v1.63.0-noble` image that CI uses, because text rasterizes differently from machine to machine. Elsewhere they are skipped; to compare or update them, run the tests inside that image with `TROMPE_SNAPSHOTS=1`.

Generated files (`src/generated/`, `dist/`, `custom-elements.json`, `llms*.txt`) are not committed. Edit `tokens/trompe.tokens.json` and `skins/*.skin.json`, then `npm run tokens`.

## License

MIT
