# Interaction layer

`trompe/interaction` (source: `src/interaction/`) makes Trompe controls move and answer the hand the way physical objects do. It is framework-free: every controller works on any element, and also plugs into Lit as a reactive controller (it calls `host.addController(this)` when the host has it).

Controllers never draw. They write a small, documented set of CSS variables and attributes on the host, fire native `input`/`change` events, and leave the look to the component's CSS. That keeps every skin free to render the same behaviour in its own material.

Live demo: the Touch Lab (`npm run` not needed: `node scripts/build-interaction-demo.mjs`, then open `dist-demo/interaction-lab.page.html`).

## Which controller to use

| Control | Controller | Host output | Events |
| --- | --- | --- | --- |
| Button, icon button, card, list row, menu item, key | `PressController` | `data-tr-pressed`, `--tr-press: 1`, `--tr-press-x`/`--tr-press-y` (-1..1, contact point) | none (activation stays the native `click`) |
| Checkbox, radio | `PressController` on each box | as above | component's own |
| Switch | `ToggleController` (plus `PressController` if wanted) | `--tr-value-ratio` (0..1) only while the hand is on it, `data-dragging` | component's own `change` |
| Tabs, segmented control, radio group, toolbar, menu, listbox | `ChoiceController` | roving `tabindex`; selector element gets `translate`/`width`/`height` (or host gets `--tr-indicator-x/y/w/h`); `data-tr-indicator`, `data-tr-moving`, `data-dragging` | via your `select(index)` callback |
| Bottom sheet, drawer, carousel, swipe row | `DragSurfaceController` | the element's own `translate`; `data-tr-state`, `data-dragging` | `onSnap(index)`, `onMove(offset, progress)` |
| Slider, fader | `LinearController` | `--tr-value-ratio`, `data-tr-state`, `data-dragging`; ARIA slider attributes | `input`, `change` |
| Knob, dial | `RotaryController` | `--tr-angle`, `--tr-value-ratio`, as above | `input`, `change` |
| Menu, popover, dialog, sheet, toast appearing | `present()` / `dismiss()` / `dialogMotion()` | WAAPI on `transform`/`opacity` | promise resolves when done |
| Invalid input | `shake(el)` | `data-tr-alert` while shaking (and instead of shaking under reduced motion) | promise |

### Where Trompe's own components use it

| Component | Controllers |
| --- | --- |
| `tr-button`, `tr-checkbox`, `tr-radio`, `tr-tab`, `tr-list-item`, `tr-nav-item`, `tr-menu-item`, `tr-option`, `tr-select` | `PressController` (CSS keys off `[data-tr-pressed]` instead of `:active`, so quick taps stay visible and dragging off cancels) |
| `tr-switch` | `PressController` + `ToggleController` (the thumb follows `--tr-value-ratio` while held, rests on `--_rest` otherwise) |
| `tr-slider` | `LinearController` with `aria: false`, `keyboard: false` (the component keeps its own ARIA and keys), `inertia: 0`, `wheel: 'focus'`; `updated()` calls `sync()` and `setOrientation()` |

Tabs and the segmented control keep their own roving keyboard and per-key press; they do not use a sliding indicator, so `ChoiceController` is left for skins that want one. `tr-knob` wiring to `RotaryController` is next.

When a component passes `track`, presses elsewhere on the host (label, readout) never start a drag. The first `sync()` after render snaps to the value; later changes glide.

## What "physical" means here, concretely

- **Every press is seen.** A tap shorter than a frame used to produce no visual change. `PressController` holds the pressed state for at least 90 ms (`--tr-motion-duration-press-min`).
- **Cancel by dragging off.** Pressing then sliding off a button releases it visually, sliding back presses it again, and releasing outside does not activate. Touch gets a 12 px slop.
- **Contact point.** Large surfaces can tip a fraction of a degree toward where the finger landed (`--tr-press-x/y`).
- **Springs, not curves.** Releases, throws, settles and glides use damped springs, solved analytically (exact at any frame rate) and baked into CSS `linear()` easings for the compositor. The token values are generated from the same physics and a unit test keeps them in sync.
- **Over-centre switches.** A grabbed switch thumb resists inside its own half, then snaps across and flips the state before the finger lifts, like a real toggle. The click that follows a drag is swallowed so it never flips twice.
- **Selectors travel.** A segmented control's puck or a tab's underline springs from the old option to the new one. Press the selected segment and slide across to choose.
- **Direct manipulation.** Sheets and carousels track the finger 1:1, stretch with an iOS-style rubber band past their ends, and on release choose a snap point from where they would coast to, then settle with a spring that starts at the finger's speed. Gestures mostly across the axis, or inside content that can still scroll, are left to the browser.
- **Sliders never jump.** Grabbing the cap keeps the offset. Clicking the track glides the cap there and keeps dragging. Shift gives 10x finer control; on touch, moving the finger sideways away from the track slows it down. Double-click resets. The mouse wheel works on hover but never hijacks a page scroll that is passing over the control.
- **Surfaces lift out of their trigger.** Menus and dialogs grow from the control that opened them, settle on a spring, and leave faster than they arrive. `dialogMotion` keeps all native `<dialog>` behaviour (modality, focus trap, focus return, Escape) and animates Escape and backdrop clicks too.

## Keyboard and accessibility

- `ChoiceController`: one Tab stop per group, arrows move (RTL aware), Home/End jump, typing letters jumps to a matching option. `activation: 'auto'` selects on focus (tabs, radio groups); `'manual'` waits for Enter/Space (menus, toolbars). Disabled items are skipped.
- `LinearController`/`RotaryController`: the APG slider pattern (arrows, Page Up/Down, Home/End), `aria-valuenow`/`min`/`max`/`valuetext`/`orientation`, focus on press without scrolling. Turn `aria`/`keyboard` off when the host component already does this.
- `PressController`: Space shows the press while held and Enter shows a tap; typing in a field inside a pressable card does not press the card.
- Focus visuals stay the component's job: use `outline`, never a glow.

## Reduced motion

`prefers-reduced-motion: reduce`, or `data-tr-motion="reduce"` on any ancestor (`"full"` forces motion on, e.g. in a demo), keeps every state change visible but removes travel: springs become instant, inertia is off, glides jump, surfaces fade in 120 ms instead of lifting, and `shake` sets `data-tr-alert` instead of moving. Direct manipulation (dragging) still follows the finger.

## Optional sound and haptics

Off by default. `feedback.configure({ sound: true, haptics: true, volume: 0.6 })` from a settings toggle. Sounds are synthesized (no files), with tiny per-play variation; haptics use `navigator.vibrate` where available and Safari's native switch haptic on iPhone. Skins choose sounds in CSS (`--tr-sound-press`, `--tr-sound-release`, `--tr-sound-detent`, `--tr-sound-toggle`, `--tr-sound-pitch`). Nothing is allocated until enabled, and `soundFor()` skips `getComputedStyle` entirely while both are off.

## Writing component CSS for it

```css
/* Press: move the cap with transform; cross-fade fixed shadow layers instead of animating box-shadow. */
.cap { transition: transform var(--tr-motion-duration-return) var(--tr-motion-easing-return); }
:host([data-tr-pressed]) .cap { transform: translateY(1.5px); transition: transform var(--tr-motion-duration-press) ease-out; }
.cap::before { /* raised shadow */ transition: opacity var(--tr-motion-duration-release); }
:host([data-tr-pressed]) .cap::before { opacity: 0; }

/* Switch: rest position from state, overridden while held. */
:host { --rest: 0; }
:host([checked]) { --rest: 1; }
.thumb { translate: calc(var(--tr-value-ratio, var(--rest)) * var(--travel)) 0;
         transition: translate var(--tr-motion-duration-throw) var(--tr-motion-easing-throw); }
:host([data-dragging]) .thumb { transition-duration: 50ms; }

/* Slider: compositor-only fill and cap. */
.track { container-type: inline-size; }
.fill { transform-origin: left; transform: scaleX(var(--tr-value-ratio)); }
.cap { translate: calc(var(--tr-value-ratio) * (100cqw - var(--cap))) 0; }
```

## Performance

Measured with `node scripts/perf-interaction.mjs` on the Touch Lab, headless Chromium with the CPU throttled 4x (a stand-in for a mid-range phone). Main-thread cost per frame while interacting:

| Interaction | Layout | Style | Script |
| --- | --- | --- | --- |
| Button press | 0.05 ms | 0.67 ms | 0.33 ms |
| Card press + tilt | 0.01 ms | 0.50 ms | 0.15 ms |
| Switch throw | 0.01 ms | 0.23 ms | 0.24 ms |
| Segmented slide | 0.01 ms | 0.20 ms | 0.25 ms |
| Slider drag | 0.18 ms | 0.18 ms | 0.15 ms |
| Sheet drag + flick | 0.02 ms | 0.39 ms | 0.31 ms |
| Carousel flick | 0.02 ms | 0.08 ms | 0.11 ms |

Every interaction stays far inside a 16.7 ms frame (and an 8.3 ms 120 Hz frame). How:

- One shared `requestAnimationFrame` loop for every spring in the page, which stops when nothing moves.
- Layout is read once per gesture (at pointer down), never during a drag, so reads and writes never interleave.
- Only `transform`, `translate` and `opacity` animate; shadows cross-fade as fixed layers.
- Variables are written only when their rounded value changes; selectors move by writing the selector element directly instead of inherited variables on a large host.
- Coalesced pointer events feed velocity estimates, so flicks are accurate without extra frames.

Two page-level rules the measurements taught us, worth following in any Trompe app:

1. **Make live readouts layout boundaries.** A value label updated on every `input` relaid out the whole page. Give it a fixed size and `contain: strict`, and update its text node's `data` instead of `textContent`. That cut slider drag layout from 4.6 ms to 0.18 ms per frame.
2. **Avoid CSS multi-column for layouts that contain live controls.** Fragmentation forces a full relayout of every column on any change inside it. Use grid or flex columns.

Bundle size: the whole layer is about 49 KB minified, 15 KB gzipped. Each controller can be imported alone: `DragSurfaceController` is 2.7 KB gzipped, `present`/`dismiss` 2.3 KB, `PressController` 4.5 KB and `ChoiceController` 5.9 KB, each including the shared optional-feedback module (3.3 KB, which allocates nothing until sound or haptics are turned on).
