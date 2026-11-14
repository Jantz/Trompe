/**
 * Trompe interaction layer: how physical controls move and answer the hand.
 *
 * Framework-free controllers that work on any element and plug into Lit as reactive controllers.
 * They never draw anything; they write a few documented CSS variables and attributes on the host,
 * fire native events, and leave visuals to the component's CSS.
 *
 * | Controller | For | Writes |
 * | --- | --- | --- |
 * | {@link PressController} | buttons, cards, rows, keys, checkboxes, radios | `data-tr-pressed`, `--tr-press`, `--tr-press-x/y` |
 * | {@link ToggleController} | switches (drag to throw) | `--tr-value-ratio` while held, `data-dragging` |
 * | {@link ChoiceController} | tabs, segmented controls, radio groups, toolbars, menus | roving tabindex, selector `translate`/size or `--tr-indicator-*` |
 * | {@link DragSurfaceController} | sheets, drawers, carousels, swipe rows | `translate`, `data-tr-state` |
 * | {@link LinearController} | sliders | `--tr-value-ratio`, ARIA slider |
 * | {@link RotaryController} | knobs, dials | `--tr-angle`, `--tr-value-ratio`, ARIA slider |
 *
 * Plus `present`/`dismiss`/`dialogMotion` for menus, popovers, dialogs and sheets, `shake` for
 * errors, `Spring`/`springEasing` physics, one shared animation `loop`, `reducedMotion`, and
 * optional `feedback` (synthesized sounds and haptics, off by default).
 */
export { Spring, springs, springEasing, stepSpring, resolveSpring } from './spring.js';
export type { SpringParams, SpringName, SpringEasing } from './spring.js';
export { loop, activeTickers, setTimeScale } from './loop.js';
export type { Ticker } from './loop.js';
export { reducedMotion } from './motion.js';
export { feedback, soundProfiles, soundFor } from './feedback.js';
export type { SoundProfile, FeedbackConfig, PlayOptions, SlideVoice } from './feedback.js';
export { PressController } from './press.js';
export type { PressOptions } from './press.js';
export { ToggleController } from './toggle.js';
export type { ToggleOptions } from './toggle.js';
export { ChoiceController } from './choice.js';
export type { ChoiceOptions } from './choice.js';
export { DragSurfaceController, rubberBand } from './drag-surface.js';
export type { DragSurfaceOptions } from './drag-surface.js';
export { present, dismiss, dialogMotion, originFrom, shake } from './surface.js';
export type { PresentOptions, SurfaceKind, DialogOptions } from './surface.js';
export { ValueController } from './value-controller.js';
export type { ValueControllerOptions, InputSource, ControlState } from './value-controller.js';
export { LinearController } from './linear.js';
export type { LinearOptions } from './linear.js';
export { RotaryController } from './rotary.js';
export type { RotaryOptions, RotaryDrag } from './rotary.js';
export { applyDetents, detentIndex, restingPoint } from './detents.js';
export type { DetentSpec } from './detents.js';
export { SizeTransition, enter, exit, removeAnimated, insertAnimated, crossfadeText, viewTransition, autoViewTransitions, afterExit, LOOK_ATTRIBUTES } from './smooth.js';
export type { SizeTransitionOptions, PartMotion } from './smooth.js';
