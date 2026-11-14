/**
 * Trompe: skeuomorphic web components that agents can build and people can feel.
 * Importing this module defines every element and installs the token stylesheet.
 */
export { TrompeElement, installGlobalStyles, define } from './internal/trompe-element.js';
export { FormControl } from './internal/form-control.js';
export { RangeControl } from './internal/range-control.js';
export * from './internal/types.js';
export { materials, finishes, profiles, realismPresets, depthLevels } from './generated/tokens.js';

export { TrButton } from './components/button/button.js';
export { TrSwitch } from './components/switch/switch.js';
export { TrSlider } from './components/slider/slider.js';
export { TrKnob } from './components/knob/knob.js';
export { TrInput } from './components/input/input.js';
export { TrPanel } from './components/panel/panel.js';
export { TrDisplay } from './components/display/display.js';
export { TrLed } from './components/led/led.js';
export { TrMeter } from './components/meter/meter.js';
export { TrCheckbox } from './components/checkbox/checkbox.js';
export { TrRadio } from './components/radio/radio.js';
export { TrRadioGroup } from './components/radio/radio-group.js';
export { TrTextarea } from './components/textarea/textarea.js';
export { TrSelect } from './components/select/select.js';
export { TrOption } from './components/select/option.js';
export { TrSegmented } from './components/segmented/segmented.js';
export { TrTabs } from './components/tabs/tabs.js';
export { TrTab } from './components/tabs/tab.js';
export { TrTabPanel } from './components/tabs/tab-panel.js';
export { TrProgress } from './components/progress/progress.js';
export { TrBadge } from './components/badge/badge.js';
export { TrToolbar } from './components/toolbar/toolbar.js';
export { TrNav } from './components/nav/nav.js';
export { TrNavItem } from './components/nav/nav-item.js';
export { TrList } from './components/list/list.js';
export { TrListItem } from './components/list/list-item.js';
export { TrDialog } from './components/dialog/dialog.js';
export { TrMenu } from './components/menu/menu.js';
export { TrMenuItem } from './components/menu/menu-item.js';
export { TrTooltip } from './components/tooltip/tooltip.js';
export { TrAvatar, initialsOf } from './components/avatar/avatar.js';
export { TrNumberField } from './components/number-field/number-field.js';
export { TrToast, TrToaster, toast, type ToastOptions, type ToastTone } from './components/toast/toast.js';
export { TrTable } from './components/table/table.js';
export { TrChart, type ChartSeries, type ChartType, type ChartRow } from './components/chart/chart.js';
export { TrCalendar, type CalendarMarkTone } from './components/calendar/calendar.js';
export { TrDatePicker } from './components/date-picker/date-picker.js';
export { parseDate } from './components/calendar/dates.js';
export { TrIcon } from './components/icon/icon.js';
export { registerIcons, iconNames } from './components/icon/icons.js';
export { TrChoiceGroup } from './components/choice/choice-group.js';
export { TrChoiceCard } from './components/choice/choice-card.js';
export { TrPagination, pageSlots } from './components/pagination/pagination.js';

// Motion: smooth size changes, enter/exit, text cross-fades and page-wide View Transitions.
export { SizeTransition, enter, exit, removeAnimated, insertAnimated, crossfadeText, viewTransition, autoViewTransitions, afterExit } from './interaction/smooth.js';
export { setTimeScale } from './interaction/loop.js';
export { reducedMotion } from './interaction/motion.js';
