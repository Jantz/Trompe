import type { Page } from '@playwright/test';

/**
 * Every state change Trompe's components can go through, as a scenario for the motion probe
 * (cli/check/motion.mjs). Each one mounts `markup` in the test fixture, then `trigger` makes one
 * change. tests/motion.spec.ts asserts that each change is animated and moves no layout.
 */
export interface MotionScenario {
  name: string;
  markup: string;
  /** Runs before measuring (after mount), to put the component in its starting state. */
  setup?: (page: Page) => Promise<unknown>;
  trigger: (page: Page) => Promise<unknown>;
  /** Extra ms before the frozen capture (for delayed reactions). */
  wait?: number;
  /** Selectors left out of the pixel comparison (text that must change at once, such as typing). */
  mask?: string[];
  /** Per-scenario limit overrides. */
  limits?: Record<string, number>;
  /** Wrap markup in a viewport-filling block so following content is visible below it. */
  follow?: boolean;
}

const set = (sel: string, prop: string, value: unknown) => (page: Page) =>
  page.evaluate(({ sel, prop, value }) => {
    (document.querySelector(sel) as unknown as Record<string, unknown>)[prop] = value;
  }, { sel, prop, value });

const attr = (sel: string, name: string, value: string | null) => (page: Page) =>
  page.evaluate(({ sel, name, value }) => {
    const el = document.querySelector(sel)!;
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  }, { sel, name, value });

const docAttr = (name: string, value: string | null) => (page: Page) =>
  page.evaluate(({ name, value }) => {
    if (value === null) document.documentElement.removeAttribute(name);
    else document.documentElement.setAttribute(name, value);
  }, { name, value });

const AFTER = '<p id="after" style="margin:16px 0 0">Content below</p>';

export const scenarios: MotionScenario[] = [
  // Buttons and toggles
  { name: 'button: hover', markup: '<tr-button id="t">Save</tr-button>', trigger: (p) => p.hover('#t') },
  { name: 'button: toggle pressed', markup: '<tr-button id="t" toggle>Bold</tr-button>', trigger: set('#t', 'pressed', true) },
  { name: 'button: disable', markup: '<tr-button id="t">Save</tr-button>', trigger: set('#t', 'disabled', true) },
  { name: 'button: tone change', markup: '<tr-button id="t">Save</tr-button>', trigger: attr('#t', 'tone', 'danger') },
  { name: 'button: keyboard focus', markup: '<tr-button id="t">Save</tr-button>', trigger: (p) => p.keyboard.press('Tab') },
  { name: 'checkbox: check', markup: '<tr-checkbox id="t">Remember me</tr-checkbox>', trigger: set('#t', 'checked', true) },
  { name: 'checkbox: uncheck', markup: '<tr-checkbox id="t" checked>Remember me</tr-checkbox>', trigger: set('#t', 'checked', false) },
  { name: 'checkbox: indeterminate', markup: '<tr-checkbox id="t">All</tr-checkbox>', trigger: set('#t', 'indeterminate', true) },
  { name: 'switch: on', markup: '<tr-switch id="t">Wi-Fi</tr-switch>', trigger: set('#t', 'checked', true) },
  { name: 'switch: off', markup: '<tr-switch id="t" checked>Wi-Fi</tr-switch>', trigger: set('#t', 'checked', false) },
  {
    name: 'radio: select another',
    markup: '<tr-radio-group label="Size" value="s"><tr-radio value="s">Small</tr-radio><tr-radio id="t" value="m">Medium</tr-radio></tr-radio-group>',
    trigger: set('#t', 'checked', true),
  },
  {
    name: 'segmented: select another',
    markup: '<tr-segmented id="t" label="View" value="a"><tr-option value="a">List</tr-option><tr-option value="b">Grid</tr-option><tr-option value="c">Columns</tr-option></tr-segmented>',
    trigger: set('#t', 'value', 'c'),
  },

  // Fields
  { name: 'input: error appears', markup: `<tr-input id="t" label="Username" value="ada"></tr-input>${AFTER}`, trigger: attr('#t', 'error', 'That name is taken.') },
  { name: 'input: error clears', markup: `<tr-input id="t" label="Username" value="ada" error="That name is taken."></tr-input>${AFTER}`, trigger: attr('#t', 'error', null) },
  { name: 'input: hint swaps to error', markup: `<tr-input id="t" label="Email" hint="We never share it."></tr-input>${AFTER}`, trigger: attr('#t', 'error', 'Enter a valid email.') },
  { name: 'input: clear button appears', markup: `<tr-input id="t" label="Search" clearable></tr-input>${AFTER}`, trigger: set('#t', 'value', 'lamps'), mask: ['#t input'] },
  { name: 'input: focus', markup: '<tr-input id="t" label="Name"></tr-input>', trigger: (p) => p.keyboard.press('Tab') },
  { name: 'textarea: error appears', markup: `<tr-textarea id="t" label="Bio"></tr-textarea>${AFTER}`, trigger: attr('#t', 'error', 'Too short.') },
  {
    name: 'textarea: autosize grows',
    markup: `<tr-textarea id="t" label="Bio" autosize rows="2"></tr-textarea>${AFTER}`,
    trigger: set('#t', 'value', 'one\ntwo\nthree\nfour\nfive\nsix'),
  },
  {
    name: 'select: open',
    markup: '<tr-select id="t" label="Country" placeholder="Choose…"><tr-option value="nl">Netherlands</tr-option><tr-option value="jp">Japan</tr-option></tr-select>',
    trigger: set('#t', 'open', true),
  },
  {
    name: 'select: close',
    markup: '<tr-select id="t" label="Country" placeholder="Choose…"><tr-option value="nl">Netherlands</tr-option><tr-option value="jp">Japan</tr-option></tr-select>',
    setup: set('#t', 'open', true),
    trigger: set('#t', 'open', false),
  },
  {
    name: 'select: value change',
    markup: '<tr-select id="t" label="Country" value="nl"><tr-option value="nl">Netherlands</tr-option><tr-option value="jp">Japan</tr-option></tr-select>',
    trigger: set('#t', 'value', 'jp'),
  },

  // Overlays
  {
    name: 'dialog: open',
    markup: '<tr-dialog id="t"><h2 slot="heading">Delete files?</h2>This cannot be undone.<tr-button slot="footer">Cancel</tr-button></tr-dialog>',
    trigger: set('#t', 'open', true),
  },
  {
    name: 'dialog: close',
    markup: '<tr-dialog id="t"><h2 slot="heading">Delete files?</h2>This cannot be undone.<tr-button slot="footer">Cancel</tr-button></tr-dialog>',
    setup: set('#t', 'open', true),
    trigger: set('#t', 'open', false),
  },
  {
    name: 'menu: open',
    markup: '<tr-button id="b">File</tr-button><tr-menu id="t" anchor="b"><tr-menu-item>New</tr-menu-item><tr-menu-item>Open…</tr-menu-item></tr-menu>',
    trigger: set('#t', 'open', true),
  },
  {
    name: 'menu: close',
    markup: '<tr-button id="b">File</tr-button><tr-menu id="t" anchor="b"><tr-menu-item>New</tr-menu-item><tr-menu-item>Open…</tr-menu-item></tr-menu>',
    setup: set('#t', 'open', true),
    trigger: set('#t', 'open', false),
  },
  {
    name: 'menu: check item',
    markup: '<tr-button id="b">View</tr-button><tr-menu id="m" anchor="b" open><tr-menu-item id="t" type="checkbox">Grid</tr-menu-item><tr-menu-item>List</tr-menu-item></tr-menu>',
    trigger: set('#t', 'checked', true),
  },
  {
    name: 'tooltip: show',
    markup: '<tr-button id="b">Share</tr-button><tr-tooltip id="t" for="b">Copy a link</tr-tooltip>',
    trigger: set('#t', 'open', true),
  },
  {
    name: 'tooltip: hide',
    markup: '<tr-button id="b">Share</tr-button><tr-tooltip id="t" for="b">Copy a link</tr-tooltip>',
    setup: set('#t', 'open', true),
    trigger: set('#t', 'open', false),
  },

  // Navigation and structure
  {
    name: 'tabs: switch panel (different heights)',
    markup: `<tr-tabs id="t" label="Settings"><tr-tab>General</tr-tab><tr-tab>Privacy</tr-tab><tr-tab-panel>Short.</tr-tab-panel><tr-tab-panel><p>Much</p><p>taller</p><p>panel</p></tr-tab-panel></tr-tabs>${AFTER}`,
    trigger: set('#t', 'value', '1'),
  },
  {
    name: 'tabs: keys variant switch',
    markup: `<tr-tabs id="t" variant="keys" value="a"><tr-tab panel="a">Video</tr-tab><tr-tab panel="b">Audio</tr-tab><tr-tab-panel name="a">One line.</tr-tab-panel><tr-tab-panel name="b">Another line.</tr-tab-panel></tr-tabs>${AFTER}`,
    trigger: set('#t', 'value', 'b'),
  },
  {
    name: 'nav: expand group',
    markup: `<tr-nav label="Main"><tr-nav-item id="t">Projects<tr-nav-item href="#a">Alpha</tr-nav-item><tr-nav-item href="#b">Beta</tr-nav-item></tr-nav-item><tr-nav-item href="#c">Settings</tr-nav-item></tr-nav>`,
    trigger: set('#t', 'expanded', true),
  },
  {
    name: 'nav: collapse group',
    markup: `<tr-nav label="Main"><tr-nav-item id="t" expanded>Projects<tr-nav-item href="#a">Alpha</tr-nav-item><tr-nav-item href="#b">Beta</tr-nav-item></tr-nav-item><tr-nav-item href="#c">Settings</tr-nav-item></tr-nav>`,
    trigger: set('#t', 'expanded', false),
  },
  {
    name: 'nav: change current',
    markup: `<tr-nav label="Main"><tr-nav-item href="#a" current>Inbox</tr-nav-item><tr-nav-item id="t" href="#b">Sent</tr-nav-item></tr-nav>`,
    trigger: async (p) => {
      await set('#t', 'current', true)(p);
      await p.evaluate(() => ((document.querySelector('tr-nav-item[current]:not(#t)') as HTMLElement & { current: boolean }).current = false));
    },
  },
  {
    name: 'list: select item',
    markup: '<tr-list selectable label="Files" value="a"><tr-list-item value="a">Notes.md</tr-list-item><tr-list-item id="t" value="b">Plan.md</tr-list-item></tr-list>',
    trigger: (p) => p.evaluate(() => ((document.querySelector('tr-list') as HTMLElement & { value: string }).value = 'b')),
  },
  {
    name: 'list: add item',
    markup: `<tr-list id="t" label="Files"><tr-list-item>Notes.md</tr-list-item><tr-list-item>Plan.md</tr-list-item></tr-list>${AFTER}`,
    trigger: (p) =>
      p.evaluate(() => {
        const li = document.createElement('tr-list-item');
        li.textContent = 'Budget.xlsx';
        document.getElementById('t')!.insertBefore(li, document.querySelector('#t tr-list-item'));
      }),
  },
  {
    name: 'list: remove item',
    markup: `<tr-list id="t" label="Files"><tr-list-item id="x">Notes.md</tr-list-item><tr-list-item>Plan.md</tr-list-item></tr-list>${AFTER}`,
    trigger: (p) => p.evaluate(() => void (document.getElementById('x') as HTMLElement & { dismiss(): Promise<void> }).dismiss()),
  },

  // Status and values
  { name: 'progress: value change', markup: '<tr-progress id="t" label="Upload" value="20" show-value></tr-progress>', trigger: set('#t', 'value', 70) },
  { name: 'progress: ring value change', markup: '<tr-progress id="t" variant="ring" label="Storage" value="20" show-value></tr-progress>', trigger: set('#t', 'value', 70) },
  { name: 'progress: becomes determinate', markup: '<tr-progress id="t" label="Sync" indeterminate></tr-progress>', trigger: async (p) => { await set('#t', 'value', 40)(p); await set('#t', 'indeterminate', false)(p); } },
  { name: 'progress: tone change', markup: '<tr-progress id="t" label="Disk" value="80"></tr-progress>', trigger: attr('#t', 'tone', 'danger') },
  { name: 'meter: value change', markup: '<tr-meter id="t" label="Level" value="0.2"></tr-meter>', trigger: set('#t', 'value', 0.8) },
  { name: 'badge: tone change', markup: '<tr-badge id="t" tone="neutral">Pending</tr-badge>', trigger: attr('#t', 'tone', 'success') },
  { name: 'badge: count grows', markup: '<span>Inbox <tr-badge id="t" tone="accent">9</tr-badge></span> next', trigger: (p) => p.evaluate(() => (document.getElementById('t')!.textContent = '10')) },
  { name: 'led: on', markup: '<tr-led id="t" color="green" label="Power"></tr-led>', trigger: set('#t', 'on', true) },
  { name: 'led: off', markup: '<tr-led id="t" on color="green" label="Power"></tr-led>', trigger: set('#t', 'on', false) },
  { name: 'slider: value set', markup: '<tr-slider id="t" label="Volume" value="20"></tr-slider>', trigger: set('#t', 'value', 80) },
  { name: 'knob: value set', markup: '<tr-knob id="t" label="Gain" value="20"></tr-knob>', trigger: set('#t', 'value', 80) },
  { name: 'display: value change', markup: '<tr-display id="t" value="12:30"></tr-display>', trigger: set('#t', 'value', '12:31') },

  // Theme, skin, light, material
  {
    name: 'theme: light to dark',
    markup: '<tr-panel><tr-button>Save</tr-button> <tr-switch checked>On</tr-switch> <tr-input label="Name"></tr-input></tr-panel>',
    trigger: docAttr('data-tr-theme', 'dark'),
  },
  {
    name: 'light: angle change',
    markup: '<tr-panel><tr-button>Save</tr-button> <tr-switch checked>On</tr-switch></tr-panel>',
    trigger: (p) => p.evaluate(() => document.documentElement.style.setProperty('--tr-light-angle', '200deg')),
  },
  {
    name: 'realism: change',
    markup: '<tr-panel><tr-button>Save</tr-button> <tr-switch checked>On</tr-switch></tr-panel>',
    trigger: docAttr('data-tr-realism', 'real'),
  },
  {
    name: 'material: change',
    markup: '<tr-panel id="t"><tr-button>Save</tr-button> <tr-switch checked>On</tr-switch></tr-panel>',
    trigger: attr('#t', 'material', 'metal'),
  },
];
