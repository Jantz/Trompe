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
- Swapping a wizard step, pane or list order: let `viewTransition()` wait for Vue to render:
  `viewTransition(async () => { step.value++; await nextTick(); })`. Use `<TransitionGroup>` only
  for items entering and leaving a list; don't nest it inside a view transition.

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
- Swapping a step, pane or list order: `viewTransition(async () => { step++; await tick(); })`.
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
| One of many options | `tr-select` + `tr-option` (`hint`, `error` as on `tr-input`) |
| On / off setting | `tr-switch`; a list of options: `tr-checkbox` (`hint`, `error` for consent boxes) |
| Amount on a scale | `tr-slider` |
| From … to … filter (price, hours) | `tr-range-slider` (`low`, `high`, `min-gap`) |
| Time slots, filters, tags | `tr-chip-group` + `tr-chip` (`multiple`, `removable`, `count`) |
| Steps of a multi-step flow | `tr-stepper` + `tr-step` (`current`, `clickable`, `linear`) |
| Upload, attachment, receipt | `tr-file-drop` (`accept`, `max-size`, `multiple`) |
| Text, time of day | `tr-input` (`type="search"` + `clearable` for search, `type="time"` for "07:30"), `tr-textarea` |
| Sections of one screen | `tr-tabs` + `tr-tab` + `tr-tab-panel` |
| App navigation | `tr-nav` + `tr-nav-item` (`current`, badges in the `end` slot) |
| Rows of things | `tr-list` + `tr-list-item` (`selectable` for a listbox) |
| Commands | `tr-menu` + `tr-menu-item`, `tr-toolbar` |
| Confirmation, form in a layer | `tr-dialog` (`show()`, `close()`, footer slot for actions) |
| Hints on icons | `tr-tooltip` |
| Icons | `tr-icon name="search"` (150+ built in; `variant` printed, engraved, embossed, lit) |
| Charts, sparklines | `tr-chart` (`type` line, area, bar, sparkline; a `<table>` inside or `data`; `baseline="data"` to zoom) |
| Date, date range | `tr-date-picker` (field + popover), `tr-calendar` (always on screen) |
| Plans, shipping options, templates | `tr-choice-group` + `tr-choice-card` (`multiple` for several) |
| Pages of results | `tr-pagination` (`total` + `page-size`, or `pages`) |
| Instrument looks only | `tr-display` (LCD/VFD), `tr-led`, `tr-meter`, `tr-knob` |

Not in Trompe yet (build with plain HTML/CSS and Trompe tokens): skeletons. For loading data, prefer
`loading` on `tr-chart` and `tr-button`, or reserve the room with `min-height`.

### Icons
`<tr-icon name="search"></tr-icon>` draws one of 150+ built-in icons (`iconNames()` lists them) at 1em, in the text colour, so it lines up in `slot="start"`/`"end"` of tr-button, tr-input, tr-list-item, tr-menu-item, tr-badge and `slot="icon"` of tr-nav-item. Don't hand-draw SVGs.
`variant` matches the material: `printed` (ink, default), `engraved` (cut in, letterpress), `embossed` (raised), `lit` (backlit glow; best on dark skins, accent by default). Relief follows the scene light.
Icons are decorative by default. An icon-only button needs a name: `<tr-button shape="circle" aria-label="Settings"><tr-icon name="settings"></tr-icon></tr-button>`, or `<tr-icon name="close" label="Close">`.
Add your own with `registerIcons({ espresso: '<path d="…"/>' })` (24×24 grid, strokes).

### Charts
Use `<tr-chart>` for line, area and bar charts and inline sparklines. Don't hand-draw SVG.
- Plain HTML: put a `<table>` inside it. The first column is the x label and each further column is a series named by its header. The table also serves screen readers.
- JS or a framework: set `data` to an array of rows, with `x="month"` and `series="income:Income,spend:Spending"`. React: `data={rows}`; Vue: `:data="rows"`.
- One run of numbers: `values="3,5,2"`. `type="sparkline"` fits a table cell or a stat tile.
- Set `label`, plus `currency="EUR"` or `unit="kg"` so values and the readout are formatted. `stacked` for parts of a total.
- The box keeps its height: set `--tr-chart-height` (default 16em). Set `loading` while fetching instead of swapping in a spinner, so nothing shifts.
- Colours come from the skin (series 1 is the accent). Override with `--tr-chart-color-N` or a series `color`.
- The value axis starts at zero for bars, areas and values near zero. `baseline="data"` fits it to the data (a weight or price line), `baseline="zero"` forces zero.

### Dates
Use `<tr-date-picker label="Check-in" name="checkin">` for a date field, and add `range` for check-in to check-out. The value is always `yyyy-mm-dd` (with `range`, `2026-11-03/2026-11-09`), whatever the person types: "3 Nov 2026" or "03/11/2026" in their locale, or a pick from the calendar. `min`, `max` and `required` validate like a native input. Block days such as weekends or booked dates with a property: `picker.isDateDisabled = (d) => d.getDay() === 0`.
For a calendar that is always on screen (a booking page, a log), use `<tr-calendar>`: the same `value`, `range`, `min` and `max`, and it can sit in a form with `name`. Don't build date grids or wrap `<input type="date">`. In Vue, Svelte and JSX, bind `first-day-of-week` as a number.

### Selectable cards and pagination
For plans, shipping options, account types or templates: `<tr-choice-group label="Plan" name="plan" value="pro" columns="3">`
holding `<tr-choice-card value="pro">Pro<span slot="description">Unlimited projects</span><span slot="end">$12/mo</span></tr-choice-card>`.
Add `multiple` for several choices; then `value` is comma-joined ("mon,thu") and `values` is the array.
`required`, `hint` and `error` work as on `tr-input`. Put a `tr-icon` in `slot="start"`. Don't hand-build
clickable cards with your own selection styling.

`<tr-pagination total="240" page-size="20" page="3">` (or `pages="12"`); listen for `change`
(`e.detail.page`). It keeps its width while paging and turns into "Page 3 of 12" on narrow screens by
itself. In Vue, Svelte and JSX, bind the numbers (`:page="3"`).

### Ranges
For "from … to …" filters (price, dates in hours, sizes) use `<tr-range-slider label="Price" min="0" max="1000" step="10" low="280" high="620" currency="EUR">`, not two `tr-slider`s.
Each cap is its own slider ("Minimum price", "Maximum price"); `min-gap` keeps them apart. Listen for `input`/`change` and read `low` and `high`.
In a form it submits two entries under `name` (`formData.getAll('price')`). `value` is "low,high". In Vue, Svelte and JSX bind the numbers (`:low="280"`).

### Chips
Use `<tr-chip-group label="Time" name="slot" value="09:30">` with one `<tr-chip>` per option for compact choices such as time slots or filters. It works like a radio group, or like checkboxes with `multiple`, and submits with forms (`required`, `hint`, `error` as on `tr-input`).
`count="12"` shows a result count that cross-fades when it changes.
Removable tags (`<tr-chip removable>`) show an × key, and Backspace or Delete removes them too. The chip animates out and its neighbours glide into place. Listen for `removed` to drop the item from your data, or call `preventDefault()` on `remove` to keep it.
A `<tr-chip>` on its own is a toggle button.

### Step indicator
`<tr-stepper current="1" clickable>` with one `<tr-step>` per step (label in the default slot, `slot="description"` for a hint). Set `current` (from 0) or `value`. Steps before it read complete, and `error` or `disabled` mark a single step.
Picking a step fires a cancelable `change` (`detail.index`, `detail.value`). `linear` allows only steps already reached. `next()` and `previous()` move it from your own buttons.
Too narrow for every step, it becomes "Step 2 of 5 · Label" with a progress tube. `compact` forces that form and `orientation="vertical"` stacks the steps.

### File drop
`<tr-file-drop label="Receipt" name="receipt" accept=".pdf,image/*" max-size="10MB" required>` is a recessed tray that is also a button: click it or press Enter or Space to choose a file, or drop files on it.
Add `multiple` (and `max-files`) for a list of files, each with its own Remove button. Files go into the form's FormData under `name`.
Files that are too large, the wrong type or too many are refused, and the error line says why. Listen for `change` (`detail.files`) and `remove`, or set `el.files` from code.
Use `compact` for a one-line tray in tight forms, and `error="…"` to show a server-side failure.

### Checkbox messages
`tr-checkbox` takes `hint` and `error` like `tr-input`, for consent boxes ("You must accept the terms"). The message appears under the label without moving the box.

### Rings with your own centre
`tr-progress variant="ring"` takes `slot="center"` for richer content than one value, such as a number
over a caption: `<span slot="center"><strong>6,240</strong><small>steps</small></span>`. Keep
`value-text` for the spoken value.

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
