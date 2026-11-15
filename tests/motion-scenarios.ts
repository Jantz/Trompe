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
  {
    name: 'progress: value text changes',
    markup: '<tr-progress id="t" label="Basket" value="0" max="49" value-text="0 of 49" show-value style="width:420px"></tr-progress>',
    trigger: (p) => p.evaluate(() => { const el = document.querySelector('#t')!; el.setAttribute('value', '1'); el.setAttribute('value-text', '1 of 49'); }),
  },
  {
    name: 'choice: card becomes disabled',
    markup: '<tr-choice-group label="Time" style="width:640px"><tr-choice-card value="a">9:00</tr-choice-card><tr-choice-card id="t" value="b">9:30</tr-choice-card></tr-choice-group>',
    trigger: attr('#t', 'disabled', ''),
  },
  {
    name: 'choice: hint changes',
    markup: `<tr-choice-group id="t" label="Delivery" hint="Prices include tax." style="width:640px"><tr-choice-card value="a">Standard</tr-choice-card></tr-choice-group>${AFTER}`,
    trigger: attr('#t', 'hint', 'Express ships tomorrow.'),
  },
  {
    name: 'input: hint changes',
    markup: `<tr-input id="t" label="Name" hint="As on your card."></tr-input>${AFTER}`,
    trigger: attr('#t', 'hint', 'Use your full name.'),
  },
  { name: 'slider: value set by code', markup: '<tr-slider id="t" label="Volume" value="8" style="width:320px"></tr-slider>', trigger: set('#t', 'value', 64) },
  { name: 'slider: arrow key step', markup: '<tr-slider id="t" label="Volume" value="9" style="width:320px"></tr-slider>', setup: (p) => p.focus('#t'), trigger: (p) => p.keyboard.press('ArrowRight') },
  { name: 'slider: becomes disabled', markup: '<tr-slider id="t" label="Volume" value="40" style="width:320px"></tr-slider>', trigger: attr('#t', 'disabled', '') },
  { name: 'knob: value set by code', markup: '<tr-knob id="t" label="Gain" value="8"></tr-knob>', trigger: set('#t', 'value', 64) },
  { name: 'knob: becomes disabled', markup: '<tr-knob id="t" label="Gain" value="40"></tr-knob>', trigger: attr('#t', 'disabled', '') },
  {
    name: 'checkbox: error appears',
    markup: `<tr-checkbox id="t" name="terms">I accept the terms</tr-checkbox>${AFTER}`,
    trigger: attr('#t', 'error', 'Accept the terms to continue.'),
  },
  { name: 'range slider: code sets low and high', markup: '<tr-range-slider id="t" label="Price" min="0" max="1000" step="10" low="80" high="620" currency="EUR" style="width:360px"></tr-range-slider>', trigger: (p) => p.evaluate(() => { const r = document.querySelector('#t') as unknown as { low: number; high: number }; r.low = 300; r.high = 900; }) },
  { name: 'range slider: arrow key step', markup: '<tr-range-slider id="t" label="Price" min="0" max="1000" step="10" low="80" high="620" style="width:360px"></tr-range-slider>', setup: (p) => p.getByRole('slider', { name: 'Maximum price' }).focus(), trigger: (p) => p.keyboard.press('PageUp') },
  { name: 'range slider: becomes disabled', markup: '<tr-range-slider id="t" label="Price" low="20" high="80" style="width:360px"></tr-range-slider>', trigger: attr('#t', 'disabled', '') },
  { name: 'chip: select another', markup: '<tr-chip-group label="Time" value="09:30"><tr-chip>09:00</tr-chip><tr-chip>09:30</tr-chip><tr-chip id="t">10:30</tr-chip></tr-chip-group>', trigger: (p) => p.click('#t') },
  { name: 'chip: toggle in multiple group', markup: '<tr-chip-group label="Cuisine" multiple><tr-chip>Thai</tr-chip><tr-chip id="t">Italian</tr-chip></tr-chip-group>', trigger: (p) => p.click('#t') },
  { name: 'chip: standalone toggle', markup: '<tr-chip id="t">Open now</tr-chip>', trigger: (p) => p.click('#t') },
  { name: 'chip: hover', markup: '<tr-chip-group label="Time"><tr-chip>09:00</tr-chip><tr-chip id="t">10:30</tr-chip></tr-chip-group>', trigger: (p) => p.hover('#t') },
  { name: 'chip: remove, neighbours follow', markup: '<div style="width:300px"><tr-chip-group label="Labels"><tr-chip removable>Bug</tr-chip><tr-chip removable>Design</tr-chip><tr-chip removable>Documentation</tr-chip><tr-chip removable>Performance</tr-chip><tr-chip removable>Release</tr-chip></tr-chip-group></div><p>Below</p>', trigger: (p) => p.getByRole('button', { name: 'Remove Design' }).click() },
  { name: 'chip: count changes', markup: '<tr-chip id="t" count="9">Results</tr-chip>', trigger: (p) => p.locator('#t').evaluate((el: any) => (el.count = '12')) },
  { name: 'chip: becomes disabled', markup: '<tr-chip-group label="Time"><tr-chip id="t">09:00</tr-chip><tr-chip>09:30</tr-chip></tr-chip-group>', trigger: (p) => p.locator('#t').evaluate((el) => el.setAttribute('disabled', '')) },
  { name: 'file drop: a file is added', markup: `<tr-file-drop id="t" label="Receipt" style="width:420px"></tr-file-drop>${AFTER}`, trigger: (p) => p.evaluate(() => { (document.querySelector('#t') as any).files = [new File(['x'], 'taxi-receipt.pdf', { type: 'application/pdf' })]; }) },
  { name: 'file drop: a file is removed', markup: `<tr-file-drop id="t" label="Receipts" multiple style="width:420px"></tr-file-drop>${AFTER}`, setup: async (p) => { await p.evaluate(() => { (document.querySelector('#t') as any).files = [new File(['x'], 'one.pdf'), new File(['y'], 'two.pdf')]; }); await p.waitForTimeout(400); }, trigger: (p) => p.getByRole('button', { name: 'Remove one.pdf' }).click() },
  { name: 'file drop: files dragged over', markup: `<tr-file-drop id="t" label="Receipt" style="width:420px"></tr-file-drop>${AFTER}`, trigger: (p) => p.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(['x'], 'a.pdf', { type: 'application/pdf' })); const el = document.querySelector('#t')!; el.dispatchEvent(new DragEvent('dragenter', { bubbles: true, composed: true, dataTransfer: dt })); el.dispatchEvent(new DragEvent('dragover', { bubbles: true, composed: true, dataTransfer: dt })); }) },
  { name: 'file drop: error appears', markup: `<tr-file-drop id="t" label="Receipt" style="width:420px"></tr-file-drop>${AFTER}`, trigger: attr('#t', 'error', 'Upload failed. Try again.') },
  { name: 'stepper: current advances', markup: '<tr-stepper id="t" current="1"><tr-step>Service</tr-step><tr-step>Clinician</tr-step><tr-step>Date</tr-step><tr-step>Details</tr-step><tr-step>Review</tr-step></tr-stepper>', trigger: set('#t', 'current', 2) },
  { name: 'stepper: jumps back several steps', markup: '<tr-stepper id="t" current="4"><tr-step>Service</tr-step><tr-step>Clinician</tr-step><tr-step>Date</tr-step><tr-step>Details</tr-step><tr-step>Review</tr-step></tr-stepper>', trigger: set('#t', 'current', 1) },
  { name: 'stepper: last step becomes complete', markup: '<tr-stepper id="t" current="2"><tr-step>Cart</tr-step><tr-step>Shipping</tr-step><tr-step>Payment</tr-step></tr-stepper>', trigger: set('#t', 'current', 3) },
  { name: 'stepper: error appears', markup: '<tr-stepper current="2"><tr-step>Cart</tr-step><tr-step id="t">Shipping</tr-step><tr-step>Payment</tr-step></tr-stepper>', trigger: attr('#t', 'error', '') },
  { name: 'stepper: collapses to compact', markup: '<tr-stepper id="t" current="1"><tr-step>Cart</tr-step><tr-step>Shipping</tr-step><tr-step>Payment</tr-step></tr-stepper>', trigger: attr('#t', 'compact', '') },
  { name: 'stepper: expands from compact', markup: '<tr-stepper id="t" current="1" compact><tr-step>Cart</tr-step><tr-step>Shipping</tr-step><tr-step>Payment</tr-step></tr-stepper>', trigger: attr('#t', 'compact', null) },
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
  // App parts (agent eval): avatar, number field, toast, table, button loading
  { name: 'button: loading', markup: '<tr-button id="t" tone="accent">Place order</tr-button>', trigger: set('#t', 'loading', true) },
  { name: 'avatar: status lamp appears', markup: '<tr-avatar id="t" name="Ada Lovelace"></tr-avatar>', trigger: attr('#t', 'status', 'online') },
  { name: 'avatar: status changes', markup: '<tr-avatar id="t" name="Ada Lovelace" status="online"></tr-avatar>', trigger: attr('#t', 'status', 'busy') },
  { name: 'number field: step up', markup: '<tr-number-field id="t" label="Guests" value="2" unit="guests"></tr-number-field>', trigger: (p) => p.evaluate(() => (document.querySelector('#t') as unknown as { stepBy(n: number): void }).stepBy(1)) },
  {
    name: 'table: sort',
    markup: '<tr-table id="t" autosort style="width:640px"><table><thead><tr><th data-sort="n">Name</th><th data-sort="q" data-numeric>Qty</th></tr></thead><tbody><tr><td>Beans</td><td>12</td></tr><tr><td>Apples</td><td>3</td></tr><tr><td>Cherries</td><td>40</td></tr></tbody></table></tr-table>',
    trigger: (p) => p.click('th[data-sort="n"]'),
  },
  {
    name: 'chart: data change line',
    markup: `<tr-chart id="t" type="line" label="Visits" style="width:560px"></tr-chart>${AFTER}`,
    setup: async (p) => {
      await p.evaluate(() => ((document.querySelector('#t') as unknown as { data: object[] }).data = [{ x: 'Mon', a: 30, b: 12 }, { x: 'Tue', a: 42, b: 20 }, { x: 'Wed', a: 36, b: 28 }, { x: 'Thu', a: 48, b: 24 }]));
      await p.evaluate(() => document.fonts.ready);
      await p.waitForFunction(() => document.querySelector('#t')!.shadowRoot!.getAnimations().length === 0);
    },
    trigger: set('#t', 'data', [{ x: 'Mon', a: 22, b: 30 }, { x: 'Tue', a: 46, b: 16 }, { x: 'Wed', a: 40, b: 34 }, { x: 'Thu', a: 31, b: 26 }]),
  },
  {
    name: 'chart: data change bar',
    markup: `<tr-chart id="t" type="bar" label="Steps" style="width:560px"><table><thead><tr><th>Day</th><th>Steps</th></tr></thead><tbody><tr><td>Mon</td><td>8200</td></tr><tr><td>Tue</td><td id="v">10400</td></tr><tr><td>Wed</td><td>6900</td></tr></tbody></table></tr-chart>${AFTER}`,
    setup: (p) => p.evaluate(() => document.fonts.ready).then(() => p.waitForFunction(() => document.querySelector('#t')!.shadowRoot!.getAnimations().length === 0)),
    trigger: (p) => p.evaluate(() => (document.querySelector('#v')!.textContent = '4300')),
  },
  {
    name: 'chart: hover readout',
    markup: `<tr-chart id="t" type="line" label="Visits" values="3,5,4,7,6" style="width:560px"></tr-chart>${AFTER}`,
    setup: (p) => p.evaluate(() => document.fonts.ready).then(() => p.waitForFunction(() => document.querySelector('#t')!.shadowRoot!.getAnimations().length === 0)),
    trigger: (p) => p.hover('#t'),
  },
  {
    name: 'table: sort from the stacked keys',
    markup: '<tr-table id="t" autosort style="width:320px"><table><thead><tr><th data-sort="n">Name</th><th data-sort="q" data-numeric>Qty</th></tr></thead><tbody><tr><td>Beans</td><td>12</td></tr><tr><td>Apples</td><td>3</td></tr></tbody></table></tr-table>',
    trigger: (p) => p.getByRole('button', { name: 'Sort by Name' }).click(),
  },
  {
    name: 'progress: ring centre content changes',
    markup: '<tr-progress id="t" variant="ring" size="lg" value="40" label="Steps"><span slot="center" id="c">4,000</span></tr-progress>',
    trigger: (p) => p.evaluate(() => { (document.querySelector('#t') as HTMLElement & { value: number }).value = 60; }),
  },
  {
    name: 'toast: show',
    markup: '<tr-button>Save</tr-button>',
    trigger: (p) => p.evaluate(() => (window as unknown as { trompe: { toast(m: string, o?: object): void } }).trompe.toast('Saved', { tone: 'success', duration: 0 })),
  },
  {
    name: 'toast: a second toast stacks',
    markup: '<tr-button>Save</tr-button>',
    setup: async (p) => {
      await p.evaluate(() => (window as unknown as { trompe: { toast(m: string, o?: object): void } }).trompe.toast('Saved', { duration: 0 }));
      await p.waitForTimeout(500);
    },
    trigger: (p) => p.evaluate(() => (window as unknown as { trompe: { toast(m: string, o?: object): void } }).trompe.toast('Synced', { tone: 'success', duration: 0 })),
  },
  {
    name: 'toast: one of two closes',
    markup: '<tr-button>Save</tr-button>',
    setup: async (p) => {
      await p.evaluate(() => {
        const t = (window as unknown as { trompe: { toast(m: string, o?: object): HTMLElement } }).trompe;
        t.toast('Saved', { duration: 0 }).id = 'first';
        t.toast('Synced', { duration: 0 });
      });
      await p.waitForTimeout(500);
    },
    trigger: (p) => p.evaluate(() => (document.getElementById('first') as unknown as { hide(r: string): void }).hide('api')),
    wait: 300,
  },
  { name: 'select: error appears', markup: `<tr-select id="t" label="Payee"><tr-option value="a">Ada</tr-option></tr-select>${AFTER}`, trigger: attr('#t', 'error', 'Choose who to pay.') },
  { name: 'select: hint appears', markup: `<tr-select id="t" label="Payee"><tr-option value="a">Ada</tr-option></tr-select>${AFTER}`, trigger: attr('#t', 'hint', 'Saved payees only.') },
  // Choice cards and pagination
  {
    name: 'choice: select another card',
    markup: '<tr-choice-group label="Plan" value="a" style="width:640px"><tr-choice-card value="a">Free<span slot="end">$0</span></tr-choice-card><tr-choice-card id="t" value="b">Pro<span slot="end">$12</span></tr-choice-card></tr-choice-group>',
    trigger: (p) => p.click('#t'),
  },
  {
    name: 'choice: toggle in a multiple group',
    markup: '<tr-choice-group label="Days" multiple style="width:640px"><tr-choice-card id="t" value="mon">Monday</tr-choice-card><tr-choice-card value="tue">Tuesday</tr-choice-card></tr-choice-group>',
    trigger: (p) => p.click('#t'),
  },
  {
    name: 'choice: error appears',
    markup: `<tr-choice-group id="t" label="Delivery" style="width:640px"><tr-choice-card value="a">Standard</tr-choice-card><tr-choice-card value="b">Express</tr-choice-card></tr-choice-group>${AFTER}`,
    trigger: attr('#t', 'error', 'Choose how to ship.'),
  },
  { name: 'choice: hover', markup: '<tr-choice-group label="Plan" style="width:640px"><tr-choice-card id="t" value="a">Free</tr-choice-card></tr-choice-group>', trigger: (p) => p.hover('#t') },
  { name: 'pagination: next page', markup: '<tr-pagination id="t" pages="12" page="2"></tr-pagination>', trigger: (p) => p.getByRole('button', { name: 'Next page' }).click() },
  { name: 'pagination: window moves', markup: '<tr-pagination id="t" pages="12" page="6"></tr-pagination>', trigger: set('#t', 'page', 7) },
  { name: 'pagination: hover', markup: '<tr-pagination id="t" pages="12" page="2"></tr-pagination>', trigger: (p) => p.getByRole('button', { name: 'Page 4' }).hover() },
  { name: 'pagination: compact step', markup: '<tr-pagination id="t" pages="40" page="3" compact></tr-pagination>', trigger: (p) => p.getByRole('button', { name: 'Next page' }).click() },
  { name: 'icon: name change', markup: `<tr-button><tr-icon id="t" slot="start" name="play" size="lg"></tr-icon>Start</tr-button>${AFTER}`, trigger: set('#t', 'name', 'pause') },
  { name: 'icon: variant change', markup: '<tr-icon id="t" name="lock" size="xl" variant="printed"></tr-icon>', trigger: set('#t', 'variant', 'embossed') },
  { name: 'icon: tone change', markup: '<tr-icon id="t" name="bolt" size="xl" variant="lit"></tr-icon>', trigger: set('#t', 'tone', 'danger') },

  // Calendar and date picker
  {
    name: 'number field: error appears',
    markup: `<tr-number-field id="t" label="Shares" value="0"></tr-number-field>${AFTER}`,
    trigger: attr('#t', 'error', 'Enter at least 1 share.'),
  },
  {
    name: 'calendar: mark a day',
    markup: `<tr-calendar id="t" readonly month="2026-11" marks="2026-11-02" locale="en-GB"></tr-calendar>${AFTER}`,
    trigger: attr('#t', 'marks', '2026-11-02,2026-11-03'),
  },
  { name: 'calendar: next month', markup: `<tr-calendar id="t" value="2026-11-14" locale="en-GB"></tr-calendar>${AFTER}`, trigger: (p) => p.click('#t [part=next]') },
  { name: 'calendar: select day', markup: '<tr-calendar id="t" value="2026-11-14" locale="en-GB"></tr-calendar>', trigger: (p) => p.click('#t [data-date="2026-11-19"]') },
  { name: 'calendar: range end', markup: '<tr-calendar id="t" range value="2026-11-03" locale="en-GB"></tr-calendar>', setup: (p) => p.click('#t [data-date="2026-11-03"]'), trigger: (p) => p.click('#t [data-date="2026-11-12"]') },
  { name: 'calendar: month grid', markup: `<tr-calendar id="t" value="2026-11-14" locale="en-GB"></tr-calendar>${AFTER}`, trigger: (p) => p.click('#t [part=title]') },
  { name: 'date picker: open', markup: `<tr-date-picker id="t" label="Check-in" value="2026-11-14" locale="en-GB"></tr-date-picker>${AFTER}`, trigger: set('#t', 'open', true) },
  { name: 'date picker: close', markup: `<tr-date-picker id="t" label="Check-in" value="2026-11-14" locale="en-GB"></tr-date-picker>${AFTER}`, setup: set('#t', 'open', true), trigger: set('#t', 'open', false) },
  { name: 'date picker: error appears', markup: `<tr-date-picker id="t" label="Check-in" locale="en-GB"></tr-date-picker>${AFTER}`, trigger: attr('#t', 'error', 'Choose a day after today.') },
  { name: 'date picker: value change', markup: '<tr-date-picker id="t" label="Check-in" value="2026-11-14" locale="en-GB"></tr-date-picker>', trigger: set('#t', 'value', '2026-12-01') },
];
