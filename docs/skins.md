# Making skins

A skin is a complete visual style: colours, light, realism, radii, type, motion, and a material for
each kind of element (walnut panels, brass knobs, ceramic fields, felt lists...). It is one JSON
file and one attribute:

```html
<link rel="stylesheet" href="./library.css" />
<body data-tr-skin="library">…</body>
```

There are three ways to make one, and they all produce the same file:

| Way | For | How |
| --- | --- | --- |
| [Trompe Studio](studio.md) | people | Describe a look or start from a skin, then tune every material, light and colour with a live preview of real app screens. Export JSON, CSS or an agent brief. |
| `trompe skin` | agents and scripts | `npx trompe skin "walnut panels with brushed brass knobs, amber accent" --out skins/library.skin.json` |
| `trompe/skin` | code | `skinFromDescription()`, `validateSkin()`, `compileSkin()`, `applySkin()` |

The Studio, the CLI, the package build and `applySkin()` share one compiler
(`src/skin/compile.ts`), so the CSS you preview is byte-for-byte the CSS you ship.

## The file

```json
{
  "name": "library",
  "description": "Walnut surfaces with brushed brass controls, dark, warm low light.",
  "colorScheme": "dark",
  "tokens": {
    "color.accent": "oklch(74% 0.16 70)",
    "light.angle": "60deg",
    "light.elevation": "25deg",
    "realism.default": 0.85,
    "radius.md": "10px",
    "font.family": "'Iowan Old Style', 'Palatino Linotype', Georgia, serif"
  },
  "elements": {
    "*": { "material": "plastic", "finish": "satin" },
    "tr-panel": {
      "material": "plastic",
      "finish": "satin",
      "texture": { "name": "wood", "scale": 1.2 },
      "vars": { "--tr-m-base": "oklch(38% 0.07 50)", "--tr-m-ink": "oklch(95% 0.02 70)" }
    },
    "tr-knob": {
      "material": "metal",
      "finish": "brushed",
      "vars": { "--tr-m-base": "oklch(76% 0.1 85)", "--tr-m-ink": "oklch(22% 0.04 70)" }
    }
  }
}
```

- `tokens`: any token by dot name (`color.*`, `light.*`, `realism.default`, `radius.*`, `font.*`,
  `motion.*`). Run `npm run build` and read `llms-full.txt` for the full list.
- `elements`: per tag (or `*` for every element). `material`, `finish` and `profile` pick bundles;
  `vars` sets their parameters (`--tr-m-*`, `--tr-f-*`, `--tr-p-*`), which is how you make a
  material that is not built in; `style` sets component properties such as `--tr-button-radius`.
- `texture`: a procedural surface texture under the material's lighting. One of `wood`, `leather`,
  `linen`, `felt`, `stone`, `paper`, `terrazzo`, `carbon`, `knurl` (or `none` to switch one off),
  optionally with `scale` (tile size, 0.25 to 4), `strength` (0 to 1) and `seed`. Textures are SVG
  generated at build time, a few hundred bytes each, and their relief is lit from the skin's own
  `light.angle`, so embossed grain catches the light on the same side as the bevels.

Anything set on an element in markup (`material="chrome"`, `style="--tr-m-base: …"`) still wins
over the skin.

## Describe a look

`skinFromDescription()` (and `trompe skin "<description>"`) turns plain language into a complete,
contrast-checked skin. It is deterministic: the same words give the same skin. It understands:

- **materials**: walnut, oak, ebony, leather (saddle, black), linen, felt, concrete, slate,
  terrazzo, carbon fibre, paper, kraft, brass, copper, gold, chrome, titanium, gunmetal, aluminium,
  anodized, knurled steel, ceramic, lacquer, candy, soft-touch, frosted and smoked glass. Words after
  a material say where it goes: "walnut **panels**", "brass **knobs**". A finish word before it
  modifies it: "**brushed** titanium", "**polished** brass".
- **looks**: retro, vintage, y2k, studio, luxury, scandinavian, japanese, industrial, automotive,
  cyberpunk, library, kitchen, clinical, rugged, playful, fintech, editorial, nautical, gaming, spa,
  cafe, minimal.
- **colour**: "amber accent", "navy", "sage" and about fifty other colour words; **scheme**: dark, light,
  night, airy.
- **light**: morning, noon, evening, sunset, golden hour, dramatic, moody, window, from the left/right/above.
- **realism**: flat, subtle, tactile, realistic, hyper-real; **shape**: sharp, rounded, pill;
  **type**: serif, mono, geometric, rounded, humanist, swiss; **motion**: snappy, calm, bouncy, heavy.

It returns `notes`, one line per decision, so you (or an agent) can see how the words were read.
`trompe skin vocab` lists every word.

## The API

```js
import { skinFromDescription, validateSkin, fixContrast, compileSkin, applySkin, materialPresets } from 'trompe/skin';

const { skin, notes } = skinFromDescription('green felt card table with polished gold knobs, dark, serif');
skin.elements['tr-button'] = { ...materialPresets.find((p) => p.id === 'lacquer').spec };

validateSkin(skin);          // [] when ready; findings carry a path, message and safe fix
fixContrast(skin);           // { skin, changed }: repairs every failing colour pair
compileSkin(skin);           // CSS scoped to [data-tr-skin='<name>']
compileSkin(skin, { scope: ':root' }); // or to a whole page

const live = applySkin(skin);            // adopts the CSS into the document
document.body.dataset.trSkin = skin.name;
live.update(nextSkin);                   // restyle in place (cheap enough for every slider tick)
```

Also exported: `materialPresets` (31 real-world material recipes), `textures` and `textureCss()`,
`paletteTokens()` (a full, passing colour palette from a hue, tint and accent), `contrast()`,
`ensureContrast()` and `parseColor()` (OKLCH, hex, rgb), and `describeVocabulary`.

## Check it

```sh
npx trompe skin check skins/library.skin.json        # format, names, WCAG contrast
npx trompe skin check skins/library.skin.json --fix  # repair contrast in place
npx trompe skin build skins/library.skin.json --out library.css
npx trompe check skins/                               # the same rules inside the full checker
```

In a Trompe checkout, files in `skins/` are compiled into `trompe/skins.css` by `npm run tokens`.
