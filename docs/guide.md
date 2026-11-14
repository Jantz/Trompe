# Building an app with Trompe

The short path from a description ("a banking app in matte ceramic") to a finished, checked screen.
Everything here ships in the package: this file is `node_modules/trompe/docs/guide.md`, and it is
also the first section of `llms.txt`.

1. Set up your framework (below), import `trompe` and the skins.
2. Pick or make a skin: `data-tr-skin="soft"`, or `npx trompe skin "<your materials and mood>"`.
3. Lay the page out with your own CSS grid; fill it with `tr-*` elements (see "Which element").
4. Check: `npx trompe check src index.html`, then build and `npx trompe check --render dist/index.html`.

## Framework setup

Every element is a standard custom element. Load them once, at the entry point:

```js
import 'trompe';            // defines every tr-* element (or import 'trompe/components/<name>')
import 'trompe/skins.css';  // the bundled skins (or 'trompe/skins/<name>.css', or your own skin CSS)
```

Attribute values in HTML are strings (`max="100"`). In frameworks, bind numbers and booleans as
values: the typings expect `max={100}` (React, Svelte) or `:max="100"` (Vue), because the framework
sets them as properties.

### Plain HTML

```html
<script type="module" src="/node_modules/trompe/dist/trompe.bundle.js"></script>
<link rel="stylesheet" href="/node_modules/trompe/dist/skins.css" />
<body data-tr-skin="soft">…</body>
```

With Vite, put the two imports above in `main.js` instead. Read values from `event.target.value`,
`.checked` or `.pressed`. Call methods on the element: `document.querySelector('tr-dialog').show()`.

### React 19

```tsx
// main.tsx
import 'trompe';
import 'trompe/skins.css';
import type {} from 'trompe/frameworks/react'; // typed JSX for every tr-* element (once, anywhere)
```

- Numbers and booleans as values: `<tr-slider max={100} value={vol} disabled={busy} />`.
- Standard events keep React names: `onInput`, `onChange`, `onClick`. Trompe's own events are
  lowercase, exactly as typed: `onselect` (menu), `onclose` / `onopen` (dialog, menu), `onsort` (table).
- Read values from the element: `onInput={(e) => setVol((e.target as TrSlider).value)}`.
- Refs take the element class: `const dlg = useRef<TrDialog>(null)` with
  `import type { TrDialog, TrSlider } from 'trompe'`; then `dlg.current?.show()`.
- `className`, `style={{…}}`, `key` and `ref` work as usual. `trompe check` reads `.tsx` files.

### Vue 3

```ts
// vite.config.ts: tell Vue the tr-* tags are custom elements
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('tr-') } } })

// main.ts
import 'trompe';
import 'trompe/skins.css';
import type {} from 'trompe/frameworks/vue';
```

- Bind numbers and booleans: `<tr-slider :max="100" :value="vol" :disabled="busy" />`. A plain
  `depth="2"` hands the element a string and fails vue-tsc; `trompe check` flags it (TR019).
- Prefer `:value` + `@input` to `v-model` (which is made for native fields): `:value="name" @input="name = ($event.target as TrInput).value"`.
- Events: `@change`, `@input`, `@click`, `@select`, `@close`, `@sort`.
- Refs: `const dlg = ref<TrDialog>()`, then `dlg.value?.show()`.

### Svelte 5

```ts
// src/app.d.ts
import type {} from 'trompe/frameworks/svelte';
// main.ts
import 'trompe';
import 'trompe/skins.css';
```

- Numbers and booleans in braces: `<tr-slider max={100} value={vol} disabled={busy} />`.
- `bind:value` does not work on custom elements: `value={vol} oninput={(e) => (vol = e.currentTarget.value)}`.
- Events: `onchange`, `oninput`, `onclick`, `onselect`, `onclose`, `onsort`.
- Svelte's a11y linter does not know that `tr-button` is a button and warns about `onclick`. Silence
  only those warnings in `svelte.config.js`:

  ```js
  export default {
    compilerOptions: {
      warningFilter: (w) => !(w.code.startsWith('a11y_') && /<tr-[a-z-]+/.test(w.frame ?? '')),
    },
  };
  ```

## Page setup

- **Skin on `<html>` or `<body>`.** `data-tr-skin` and `data-tr-theme` work on any element, but put
  the page's skin on `<html>` or `<body>`: then the page background takes the skin's canvas colour.
  On an inner wrapper, only that wrapper changes.
- **One light.** Set `--tr-light-angle` (0deg = from the top, clockwise) once, on the skin element.
- **Backdrops under glass** (the `aurora` skin, `material="glass"`): give the page a background and
  the glass blurs it. `body { background: radial-gradient(…), linear-gradient(…) fixed; }` works
  (your CSS beats Trompe's defaults), as does a fixed element at `z-index: -1`.
- **Layout is yours.** Trompe has no grid or stack element: use CSS grid and flex. Panels are cards.
  For a scrolling list or reading pane, `<tr-panel scrollable>` with a height (or a grid row): the
  header and footer stay put and the body scrolls.
- **Fields have an intrinsic width** (input 16em, select 14em, number field 9em) and never grow past
  their container. In forms, make them fill the column: `form :is(tr-input, tr-select, tr-textarea, tr-number-field) { width: 100%; }`.
- **No layout shifts.** A page whose `<html>` or `<body>` carries a skin stays transparent until
  Trompe's elements are defined (at most 1.2s), then fades in, so nothing jumps while they render.
  Toasts float over the page (`toast()`); dialogs, menus and tooltips live in
  the top layer. For text that appears in the flow (a status line, a field's `error` message under
  its field), reserve the room (`min-height`) when nothing around it should move.
- **`hidden` works** on every tr-* element. Fonts: Trompe uses the system font stack
  (`--tr-font-family`); load your own and set the token to change it.

## Which element for which need

| Need | Use |
| --- | --- |
| Card, section, sidebar surface | `tr-panel` (`header` / `footer` slots; `depth`, `padding`) |
| Data table, admin list, orders | `tr-table` around a native `<table>` (sortable headers, stacks into cards on phones) |
| Short success / error notice | `toast('Saved', { tone: 'success' })` (import `{ toast }` from `trompe`), or `tr-toast` |
| Person, team, account | `tr-avatar name="Ada Lovelace"` (initials or `src` photo, `status` lamp) |
| Quantity, sets, guests | `tr-number-field` (− / + keys, min, max, step, unit) |
| Submit in progress | `tr-button loading` (keeps its size, ignores clicks) |
| Status, count, tag | `tr-badge` (`tone`, `variant="enamel|plate|well"`) |
| Progress, goal, timer ring | `tr-progress` (`variant="ring"`, `show-value`, `value-text="1:30"` for the cap) |
| One of a few options | `tr-segmented` (short labels) or `tr-radio-group` (longer labels) |
| One of many options | `tr-select` + `tr-option` |
| On / off setting | `tr-switch`; a list of options: `tr-checkbox` |
| Amount on a scale | `tr-slider` |
| Text | `tr-input` (`type="search"` + `clearable` for search), `tr-textarea` |
| Sections of one screen | `tr-tabs` + `tr-tab` + `tr-tab-panel` |
| App navigation | `tr-nav` + `tr-nav-item` (`current`, badges in the `end` slot) |
| Rows of things | `tr-list` + `tr-list-item` (`selectable` for a listbox) |
| Commands | `tr-menu` + `tr-menu-item`, `tr-toolbar` |
| Confirmation, form in a layer | `tr-dialog` (`show()`, `close()`, footer slot for actions) |
| Hints on icons | `tr-tooltip` |
| Instrument looks only | `tr-display` (LCD/VFD), `tr-led`, `tr-meter`, `tr-knob` |

Not in Trompe yet (build with plain HTML/CSS and Trompe tokens): charts, date pickers, pagination
(use two `tr-button`s and "Page 2 of 5"), skeletons, icons (inline SVG at `1em`).

## Making it look professional

- **One skin, one light, one realism** per screen. Change the look with the skin, not per element.
- **Instrument parts are for instrument looks.** Screws (`tr-panel screws`), LCD/VFD readouts
  (`tr-display`) and LEDs look great on a hi-fi or lab-equipment brief and odd on a bank or spa:
  there, show numbers as large text and status as `tr-badge`.
- **Depth budget:** canvas 0, panels 2, controls 1, wells -2, floating layers 3-4. Three raised
  levels at most (`trompe check` warns).
- **Textures belong on big quiet surfaces.** Skins keep fields plain; if a texture fights text,
  lower its `strength` in the skin JSON.
- **Accessible names:** icon-only buttons need `aria-label`. When a control has visible text,
  either leave `aria-label` off or make it start with the same words (`trompe check` rule TR018).

## Skins from a description

```sh
npx trompe skin "warm white porcelain, cobalt accent, soft daylight from the top left" --name porcelain \
  --out src/porcelain.skin.json --css src/porcelain.css
```

Then `import './porcelain.css'` and `<body data-tr-skin="porcelain">`. Read the notes it prints: they
say what it understood (surfaces, controls, accent, light) and which words it did not use. To
adjust, edit the JSON (`tokens` such as `"color.accent"`, `"color.canvas"`, `"light.angle"`; per
element `material`, `finish`, `texture`, `vars`) and rebuild the CSS:
`npx trompe skin build src/porcelain.skin.json --out src/porcelain.css`. `npx trompe skin vocab`
lists every word it knows.

Textures (wood, leather, linen, felt, stone, marble, paper, terrazzo, carbon, knurl) are set per
element in a skin: `"texture": { "name": "wood", "strength": 0.3, "scale": 1 }`. `strength` (0-1) is
the depth of the relief; `scale` multiplies the tile size. Outside skins, `textureCss(name, options)`
from `trompe/skin` returns `{ image, size }`: a grey relief to blend over a colour, e.g.
`background: var(--tex) 0 0 / var(--tex-size), oklch(40% 0.05 50); background-blend-mode: hard-light;`
(apply it to your own elements; on tr-* elements set `--tr-m-texture` and `--tr-m-texture-size`).

You can also restyle without a skin: every token is a CSS variable (`--tr-color-accent`,
`--tr-radius-md`, `--tr-light-angle`), and your CSS always wins over Trompe's defaults.

## Checking

```sh
npx trompe check src index.html             # .html, .vue, .svelte, .jsx/.tsx, Lit, .css, *.skin.json
npx trompe check --format json src         # findings with rule ids, allowed values and fixes
npx trompe check --fix src                 # fix typos in names and values
npm run build && npx trompe check --render dist/index.html   # + axe, contrast, target size, forced colours
```

Custom skins in the project (skin JSON, skin CSS, `applySkin`) and skin stylesheets imported from
JavaScript are recognised. `--render` needs Playwright (a project or global install).
