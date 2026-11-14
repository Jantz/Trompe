# Authoring an object study

The object gallery shows what Trompe's light, material and interaction model can reach when pushed to real-life fidelity. Each study is one original object (never a copy of a real product), built in one HTML file with no images: every surface is CSS gradients, shadows, procedural SVG textures and a small amount of SVG.

This guide is the contract every study follows, written for agents as much as for people.

## Files

- `gallery/<slug>.html`: the study. Standalone, no build step.
- It links `kit/objects.css` and imports from `kit/objects.js`. Google Fonts are allowed; nothing else external.
- No raster images, no base64 bitmaps. Procedural SVG textures (`--tr-tex-*` in the kit, or your own `feTurbulence` tiles) are fine.
- Keep the file under about 70 KB.

## Originality

Invent the object. No real brand names, logos, model numbers or recognisable trade dress (no red dot badges, no famous colourways, no copied panel layouts). Typical archetypes (a rangefinder top plate, a receiver with a dial window) are fine; the specific design must be yours.

## Light

All lighting reads the scene light from the kit, so turning the light dial in the top bar re-lights the whole object:

- `--tr-light-angle`: where the light comes from (0deg top, clockwise; default 315deg, upper left).
- `--tr-shadow-x`, `--tr-shadow-y`: unit vector pointing away from the light. Use them for every shadow offset, rim-light side and highlight position.
- `--tr-shadow-len`: shadow length from the light's elevation.

```css
box-shadow:
  calc(var(--tr-shadow-x) * 1px) calc(var(--tr-shadow-y) * 1px) 1px #0008,           /* contact */
  calc(var(--tr-shadow-x) * 8px * var(--tr-shadow-len)) calc(var(--tr-shadow-y) * 10px * var(--tr-shadow-len)) 18px #0005; /* key */
background: linear-gradient(calc(var(--tr-light-angle) + 180deg), var(--lit), var(--shade));
```

Never hard-code a shadow direction. Check your study with the light at 315deg, 45deg and 180deg.

Rotating parts rotate only what physically turns (knurl, pointer line, numerals, grip). Specular highlights, environment reflections, cast shadows and the conic sheen of spun metal stay fixed, because the light does not turn with the knob. Build a knob as stacked layers: static shadow and gloss layers above and below a rotating layer that reads `--tr-angle`.

## The layer stack

Realism comes from many cheap, consistent layers: cast shadow (contact + key + ambient), socket or recess the part sits in, dark parting line, bevel/chamfer catching light on one side, face with curvature falloff, texture (kept below 0.6 opacity under text), environment reflection for polished metal and glass, specular gloss, bounce light, engraved or printed glyphs, emissive light (LEDs, backlit scales, displays) that ignores the scene light.

Details that sell it: chamfers that catch a hairline of light, screw heads with slots at random angles, seams and parting lines, slightly different radii per part, legends that look printed (screen-printed, engraved, pad-printed) rather than typed, wear on edges where hands would touch, tolerances (a 1px gap around a key).

## Interaction and feedback

Use the kit controllers; their API matches the interaction layer in `src/interaction/`, so studies can move onto it later by changing the import.

| Control | Controller | Notes |
|---|---|---|
| Knob, dial, encoder, flywheel | `RotaryController` | `step` or `detents` for clicks, `inertia` for flywheels, `endless` + `perTurn` for encoders |
| Fader, slider, lever, thumbwheel | `LinearController` | `returnTo` for spring-loaded levers |
| Button, key, shutter release | `PressController` | `phases: [0.45, 1]` for a two-stage press, `mode: 'latching'` + `group` for interlocking keys |
| Toggle, rocker, slide switch | `ToggleController` | `positions: 3` for centre-off |

Controllers write `--tr-angle`, `--tr-value-ratio`, `--tr-press`, `data-tr-state`, `data-tr-phase`, `data-dragging` and ARIA state to the host, and fire native `input`/`change`. Style from those: e.g. `transform: translateY(calc(var(--tr-press) * 0.18em))`.

Rules:

- Every control works with mouse, touch and keyboard, has an accessible name (`aria-label`) and a meaningful `valueText`.
- State never relies on depth alone: add a second cue (LED, legend colour, pointer position, printed label).
- Feedback lands in the same frame as the input. Pick a sound profile that matches the material (`tick`, `detent`, `click`, `clack`, `latch`, `thunk`, `slide`, `key`, `keyUp`, `plug`, `unplug`, `shutter`, `paper`, `snap`, `flip`, `beep`). `feedback.define()` adds your own.
- Physical behaviour: detents snap with a slight overshoot, toggles throw over centre, keys bottom out, needles have ballistics (use `animate()` with a spring, not CSS transitions), flywheels coast.
- Animate only `transform` and `opacity`. Never transition `box-shadow`, `filter` or gradients.
- `prefers-reduced-motion` is handled by the kit for its own motion; respect it in yours (no idle animation, needles jump).

## Responsive

- Size the object in `em` and set its `font-size` from a container query unit (`container-type: inline-size` on the stage, `font-size: clamp(7px, 1.6cqi, 16px)` on the object), so it scales like a vector drawing.
- Below about 640px, re-flow, don't just shrink: stack sections, move secondary controls, keep hit targets at least 24px (44px for primary controls).
- No horizontal scroll at 390px wide.

## Performance

- `contain: layout paint` on the object root.
- At most a few `backdrop-filter` surfaces. SVG filters only on small, static elements.
- One animation loop: the kit's `animate(fn)`; return `false` to stop. Nothing animates while idle unless it's the point (a meter showing a live signal), and that stops when the tab is hidden.

## Page frame

```html
<link rel="stylesheet" href="kit/objects.css">
<script type="module">
  import { mountBar, RotaryController } from "./kit/objects.js";
  mountBar({ title: "Object name", subtitle: "Material world, one line", tone: "dark" });
</script>
```

Put the object on a believable surface (bench, desk, wall) with a soft contact shadow, then a `.tg-caption` section: two or three short paragraphs on what it is and how it's built, and a list of the controls.

## Checking your work

```bash
node gallery/tools/shoot.mjs <slug>.html /tmp/trompe-shots/<slug> [--script=steps.mjs]
```

It serves `gallery/`, captures desktop (1440x900) and phone (390x844 at 2x), and prints console errors. A step script (`export default async (page) => {...}`) can drive controls and take more shots. Look at every shot and critique it like a senior industrial designer: does each material read as that material, is the light consistent, are proportions and type right, what still looks fake?
