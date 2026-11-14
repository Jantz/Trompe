# Motion: smooth by default

Trompe's rule: **nothing changes in a single frame, and nothing moves that you did not move.** Every state change a person causes animates, nothing that appears pushes other content in one jump, and everything still works, faster and without travel, under reduced motion.

This page covers what the components already do, the primitives you can use in your own code, and the checks that keep it true.

## What the components do

| Change | How it animates |
| --- | --- |
| Pressed, checked, selected, on/off, hover | Colors, glows, edges and depth transition. Internal custom properties that drive them (`--_on-glow`, `--_sel`, `--_tone`, ...) are registered with `CSS.registerProperty`, so even gradients and glows built from them interpolate. |
| Switch, slider, knob, progress, meter | The moving part travels on a spring or a short glide; values never jump. Progress and meter values glide; indeterminate progress has its own runner. |
| Menu, select listbox, tooltip | Enter with `@starting-style`, leave with `transition-behavior: allow-discrete` on `display` and `overlay`, so the exit plays before the popover is removed. The item under the pointer stays lit while the menu fades. |
| Dialog | Rises and scales in on a spring over a fading backdrop, and leaves faster than it arrives. |
| Tabs | The panel area animates its height to the new panel, and the panels cross-fade. The old panel is `inert` and hidden from assistive tech while it fades. |
| Nav groups | Open and close by animating `grid-template-rows` from `0fr` to `1fr` while the items fade, so the items below slide. |
| List rows | A row added to a list on screen opens into place; `item.dismiss()` fades a row while its height closes. |
| Input and textarea messages | Hints and errors fade in and out, their area animates its height, and a changed message cross-fades. The clear button is always laid out and only fades, so the field never reflows. |
| Badge, progress, display text | A changed count or label cross-fades, and its box eases to the new width. |
| Theme, skin, realism, material, light | Changes to `data-tr-theme`, `data-tr-skin`, `data-tr-realism`, `data-tr-material`, `data-tr-finish` and `data-tr-profile` on any element, and to `material`, `finish`, `profile` and `realism` on Trompe elements, made by any code, run inside a View Transition. Light angle, elevation and realism also transition as registered properties. Opt out with `data-tr-view-transitions="off"` on the root. |
| Focus | The focus ring arrives with a short settle. It leaves at once by design, so only one control ever looks focused. |

## Primitives

From `trompe` (or `trompe/interaction`):

- `new SizeTransition(host, () => ({ outer, inner }), { axis, duration, pin })` keeps `outer` at the size of `inner` and animates it whenever `inner` changes size. Because `outer` never snaps, no layout shift is reported. With `pin: false`, `outer` sizes itself between changes (so it can stretch or fill) and only changes announced with `hold()` animate; tabs use this so a panel can fill the folder. A Lit reactive controller; also works on plain elements.
- `enter(el, { y, scale, duration })` and `exit(el, ...)` fade a small part in or out (`exit` resolves when the part is gone).
- `insertAnimated(el)` opens a just-inserted element into place; `removeAnimated(el)` fades it while its height closes, then removes it.
- `crossfadeText(el, previousText)` cross-fades a label whose text you just replaced.
- `viewTransition(update)` runs a page-wide change inside a View Transition. `autoViewTransitions()` does it for the look attributes above (Trompe calls it for you). To capture the old look, it shows the old attribute values again until the next frame, so code that reads such an attribute back in the same frame sees the old value; Trompe elements keep their properties at the new value. Wrap a change in `viewTransition()` yourself when you need to read the attribute right away.
- `afterExit(el)` resolves once an element's exit transitions have finished, for code that must wait (unplacing a popover, removing a node).
- `setTimeScale(scale)` scales every JS spring (0 freezes them). Used by the probe; handy for slow-motion debugging.

Everything honours `prefers-reduced-motion` and `data-tr-motion="reduce"` on an ancestor: sizes snap, travel is removed, and CSS transitions inside components are turned off (Trompe elements mirror the attribute as `data-tr-reduced` on themselves, since an ancestor selector cannot reach into shadow roots). Only short opacity fades remain.

## How to keep your own UI smooth

- Transition what changes: `color`, `background-color`, `box-shadow`, `opacity`, `translate`, `scale`, `filter`. Gradients do not interpolate, so drive their stops with registered custom properties (`@property --lit { syntax: "<number>"; inherits: true; initial-value: 0; }`) and transition those.
- For anything that appears: `@starting-style` plus `transition-behavior: allow-discrete` on `display` (and `overlay` for popovers and dialogs), or keep it laid out and fade it.
- For anything that changes height: reserve the space, use `grid-template-rows: 0fr` to `1fr`, or `SizeTransition`.
- For structural swaps (a pane, a wizard step, a re-sorted list): run the DOM update inside `viewTransition()` and give the regions that move a `view-transition-name` so they glide instead of cross-fading.

## The checks

**The motion probe** (`cli/check/motion.mjs`) works on any Playwright page in Chromium. It freezes every animation on the page (CSS, WAAPI and Trompe's JS springs), makes the change, and captures the next frame. With time stopped, an animated change has not started yet, so anything that already looks different happened instantly. Then time runs, the page settles, and a final frame is captured. From the three frames and Chromium's layout-shift entries it reports:

- `instant`: the share of the changed pixels already final in the frozen frame (limit 15%),
- `shift`: the layout-shift score, plus elements that moved or resized more than 1.5 px without animation,
- `appeared` / `vanished`: elements that popped in or out without a transition.

Changes made under a View Transition are judged by pixels only, since the page is shown as animated snapshots while the DOM below updates.

**Tests.** `tests/motion.spec.ts` runs the probe on more than fifty scenarios, at least one for every component state change (press, toggle, open, close, select, validate, type, add, remove, retheme, relight). A component change that cuts, jumps or pops fails the suite.

**`trompe check --render`** clicks every visible control on a page and reports `TR120 unanimated-change`, `TR121 layout-shift` and `TR122 pop-in` (see [check.md](check.md#motion-tr120-to-tr122)). Run it on generated UIs; `--no-motion` skips the sweep.

To debug one change, set `TROMPE_MOTION_REPORT=1` (prints each measurement) or `TROMPE_MOTION_FRAMES=<dir>` (saves the before, frozen and settled frames) when running `tests/motion.spec.ts`.
