# Trompe Studio

A live editor for composing your own Trompe skin. Everything you change restyles real app screens
(settings, dashboard, files, checkout, smart home, and every component) as you drag, and the result
exports as a skin file the library, the build and `trompe check` all understand.

```sh
npm run dev:studio      # live, from source, at /studio/
npm run build:studio    # one self-contained file: studio/dist/index.html
```

The built file has no dependencies and no network requests; host it anywhere or open it from disk.

## Working in it

- **Describe**: write what it should look and feel like ("walnut panels with brushed brass
  controls, amber accent, low evening light, serif type") and press *Generate skin*. You get a
  complete skin plus a list of how each word was read. The dice button picks a surprise. See
  [skins.md](skins.md#describe-a-look) for the vocabulary.
- **Light**: drag the light source on the pad (angle and height); every bevel, highlight, shadow and
  texture relief follows. Realism and depth set how physical the whole skin feels.
- **Colour**: a harmony editor (scheme, hue, tint, accent, crispness) that always produces passing
  WCAG contrast, plus every colour token for hand tuning.
- **Materials**: pick a role (surfaces, buttons, fields, toggles, ranges, choice, lists, overlays),
  then a real-world material from the library (33 presets across plastics, metals, glass, woods,
  leathers, textiles, minerals and paper), and fine-tune substance, colour, finish, profile,
  texture scale and strength.
- **Shape and type**: roundness and each radius, pill buttons, control height, typeface (system
  font stacks only, so a skin never downloads anything) and weights.
- **Motion**: snappy, calm, bouncy or heavy, with a demo that presses and slides real controls.
- **Check**: the same findings `trompe check` reports, with one-click contrast fixes. The pill in
  the top bar shows the state at all times.

**Inspect** (or press `I`): click any control in the preview to jump to its material. **Device**
switches desktop, tablet and phone widths; **Backdrop** puts a vivid image behind the preview for
judging glass and translucent materials.

Undo and redo cover every change (`Ctrl+Z`, `Ctrl+Shift+Z`). The draft is saved in the browser, and
**Share** copies a link that contains the whole skin.

## Export

- **Skin JSON**: save as `skins/<name>.skin.json`; `npm run tokens` builds it into `skins.css` and
  `trompe check` validates it.
- **CSS**: ready to load after Trompe; apply with `data-tr-skin="<name>"`.
- **Use it**: a copy-paste HTML snippet, and the runtime path with `applySkin()`.
- **For agents**: a brief with the plain-language seed, the API calls and the exact skin, so an
  agent can recreate or extend it.

## How it stays smooth

The editor is built so nothing jumps while you work: the layout is a fixed grid, panels and screens
are stacked and cross-faded rather than inserted, discrete changes (a new skin, a device switch) run
through view transitions, slider input is batched to one recompile per frame, and the app fades in
only after every element is defined. The Studio's Playwright tests (`tests/studio.spec.ts`) fail on
any layout shift in the editor.
