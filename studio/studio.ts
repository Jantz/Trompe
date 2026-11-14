/**
 * Trompe Studio: compose a skin by hand or from words, see it live on real app screens, check it,
 * export it. Everything the Studio does goes through the public trompe/skin API, so whatever it
 * can do, an agent can do with the same calls.
 */
import '../src/index.ts';
import { materials, finishes, profiles } from '../src/generated/tokens.js';
import {
  applySkin,
  compileSkin,
  contrastReport,
  fixContrast,
  formatOklch,
  materialPresets,
  motionFeels,
  paletteFromTokens,
  paletteTokens,
  parseColor,
  presetSpec,
  skinFromDescription,
  textureDeclarations,
  textures,
  toHex,
  validateSkin,
  type PaletteInput,
  type Skin,
  type SkinElement,
  type SkinTexture,
} from '../src/skin/index.js';
import { contrast as contrastFn } from '../src/skin/color.js';
import { SCREENS, SPRITE } from './screens.js';
import soft from '../skins/soft.skin.json';
import studioSkin from '../skins/studio.skin.json';
import chrome from '../skins/chrome.skin.json';
import heritage from '../skins/heritage.skin.json';
import aurora from '../skins/aurora.skin.json';

/* ============================================================== helpers */

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | number | undefined> = {}, ...kids: (Node | string | null | undefined)[]) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids) if (k != null) el.append(k);
  return el;
};
const tr = (tag: string, attrs: Record<string, string | boolean | number | undefined> = {}, ...kids: (Node | string)[]) =>
  h(tag as 'div', attrs, ...kids) as unknown as HTMLElement & { value: unknown; checked?: boolean; disabled?: boolean };
const svgIcon = (id: string, size = 16) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('width', String(size));
  s.setAttribute('height', String(size));
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<use href="#i-${id}"/>`;
  return s;
};
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const num = (v: unknown, d: number) => {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : d;
};

/* ============================================================== skins to start from */

const builtIns = [soft, studioSkin, chrome, heritage, aurora] as unknown as Skin[];
const EXAMPLES: { id: string; label: string; prompt: string }[] = [
  { id: 'library', label: 'Walnut & brass', prompt: 'old library: walnut panels with brushed brass controls, amber accent, low evening light, serif type' },
  { id: 'lab', label: 'Ceramic lab', prompt: 'clinical white ceramic and brushed aluminium, teal accent, soft rounded corners, calm' },
  { id: 'racing', label: 'Carbon racing', prompt: 'carbon fiber racing dashboard with red accents, sharp corners, snappy' },
  { id: 'atelier', label: 'Linen & oak', prompt: 'scandinavian oak and linen settings, sage accent, airy and calm' },
  { id: 'casino', label: 'Felt & gold', prompt: 'green felt card table with polished gold knobs, dark, serif type, dramatic light' },
  { id: 'concrete', label: 'Concrete & steel', prompt: 'brutalist concrete panels with knurled steel controls, orange accents, mono type, sharp corners' },
  { id: 'saddle', label: 'Saddle leather', prompt: 'luxury saddle leather with copper trim, warm, rich, golden hour light' },
  { id: 'terrazzo', label: 'Terrazzo café', prompt: 'café terrazzo surfaces with glossy coral lacquer buttons, friendly rounded, bouncy' },
];
const examples: Skin[] = EXAMPLES.map((e) => ({ ...skinFromDescription(e.prompt, { name: e.id }).skin }));

/* ============================================================== roles */

interface Role {
  id: string;
  label: string;
  tags: string[];
}
const ROLES: Role[] = [
  { id: 'base', label: 'Everything', tags: ['*'] },
  { id: 'surfaces', label: 'Panels & cards', tags: ['tr-panel'] },
  { id: 'buttons', label: 'Buttons', tags: ['tr-button'] },
  { id: 'fields', label: 'Fields', tags: ['tr-input', 'tr-textarea', 'tr-select'] },
  { id: 'toggles', label: 'Toggles', tags: ['tr-switch', 'tr-checkbox', 'tr-radio'] },
  { id: 'ranges', label: 'Sliders & knobs', tags: ['tr-slider', 'tr-knob', 'tr-progress', 'tr-meter'] },
  { id: 'choice', label: 'Tabs & segments', tags: ['tr-segmented', 'tr-tabs', 'tr-tab'] },
  { id: 'lists', label: 'Nav & lists', tags: ['tr-nav', 'tr-list', 'tr-toolbar', 'tr-nav-item', 'tr-list-item'] },
  { id: 'overlays', label: 'Menus & dialogs', tags: ['tr-menu', 'tr-dialog', 'tr-tooltip'] },
];
const roleOfTag = (tag: string): Role => {
  const t = tag.toLowerCase();
  const alias: Record<string, string> = { 'tr-nav-item': 'tr-nav', 'tr-list-item': 'tr-list', 'tr-menu-item': 'tr-menu', 'tr-option': 'tr-segmented', 'tr-tab-panel': 'tr-tabs', 'tr-radio-group': 'tr-radio', 'tr-display': 'tr-knob', 'tr-led': 'tr-knob', 'tr-badge': '*' };
  const key = alias[t] ?? t;
  return ROLES.find((r) => r.tags.includes(key)) ?? ROLES[0]!;
};

/* ============================================================== state */

interface State {
  skin: Skin;
  palette: PaletteInput;
  role: string;
  panel: string;
  screen: string;
}

const STORE_KEY = 'trompe-studio/draft/v1';
const state: State = {
  skin: clone(examples[0]!),
  palette: paletteFromTokens(examples[0]!.tokens ?? {}, examples[0]!.colorScheme ?? 'light'),
  role: 'surfaces',
  panel: 'describe',
  screen: 'settings',
};

/* ============================================================== live preview */

const frame = $('#frame');
const canvas = $('#canvas');
let applied: ReturnType<typeof applySkin> | null = null;
let frameQueued = 0;
const draftOf = (skin: Skin): Skin => ({ ...skin, name: 'draft' });

/**
 * While a pointer is down in the editor (dragging the light, a slider), textures keep the light
 * they had when the drag began: their relief is rebuilt once, on release, instead of every frame.
 */
let dragLight: { angle: number; elevation: number } | null = null;
const lightNow = () => ({ angle: parseFloat(String(state.skin.tokens?.['light.angle'] ?? 330)) || 330, elevation: parseFloat(String(state.skin.tokens?.['light.elevation'] ?? 55)) || 55 });
document.addEventListener('pointerdown', (e) => {
  if ((e.target as Element).closest?.('.rail')) dragLight = lightNow();
}, true);
const endDrag = () => {
  if (!dragLight) return;
  dragLight = null;
  schedule();
};
document.addEventListener('pointerup', endDrag, true);
document.addEventListener('pointercancel', endDrag, true);

function flush() {
  cancelAnimationFrame(frameQueued);
  frameQueued = 0;
  try {
    if (!applied) applied = applySkin(draftOf(state.skin));
    else applied.update(draftOf(state.skin), dragLight ? { textureLight: dragLight } : undefined);
  } catch (e) {
    toast(`Could not apply: ${(e as Error).message}`);
  }
  refreshChecks();
}
/** Restyle on the next frame: many input events per frame collapse into one recompile. */
function schedule() {
  if (!frameQueued) frameQueued = requestAnimationFrame(flush);
}

/** Runs a discrete change as an animated cross-fade of the preview (View Transitions). */
function animated(change: () => void, type?: string) {
  type VT = { updateCallbackDone?: Promise<void>; finished: Promise<void> };
  const doc = document as unknown as { startViewTransition?: (arg: (() => void) | { update: () => void; types?: string[] }) => VT };
  if (reduceMotion.matches || !doc.startViewTransition) {
    change();
    flush();
    return;
  }
  const update = () => {
    change();
    flush();
  };
  // The morphing frame keeps its colour while the layouts inside it swap.
  document.documentElement.style.setProperty('--pv-canvas', getComputedStyle(frame).backgroundColor);
  let vt: VT;
  try {
    vt = doc.startViewTransition(type ? { update, types: [type] } : update);
  } catch {
    vt = doc.startViewTransition(update); // browsers without transition types
  }
  // The change runs asynchronously inside the transition, so history and persistence wait for it.
  const done = (vt.updateCallbackDone ?? vt.finished).catch(() => {});
  const p: Promise<void> = done.then(() => {
    if (pendingUpdate === p) pendingUpdate = null;
  });
  pendingUpdate = p;
}
let pendingUpdate: Promise<void> | null = null;
/** Runs fn once any animated state change in flight has been applied. */
function afterUpdate(fn: () => void) {
  if (pendingUpdate) void pendingUpdate.then(fn);
  else fn();
}

/* ============================================================== history */

let undoStack: string[] = [];
let at = -1;
let persistTimer = 0;
function commit() {
  if (pendingUpdate) return afterUpdate(commit);
  const json = JSON.stringify(state.skin);
  if (undoStack[at] === json) return;
  undoStack = undoStack.slice(0, at + 1);
  undoStack.push(json);
  if (undoStack.length > 120) undoStack.shift();
  at = undoStack.length - 1;
  updateHistoryButtons();
  clearTimeout(persistTimer);
  persistTimer = window.setTimeout(persist, 400);
}
function updateHistoryButtons() {
  ($('#undo') as HTMLElement & { disabled: boolean }).disabled = at <= 0;
  ($('#redo') as HTMLElement & { disabled: boolean }).disabled = at >= undoStack.length - 1;
}
function travel(delta: number) {
  const next = at + delta;
  if (next < 0 || next >= undoStack.length) return;
  at = next;
  load(JSON.parse(undoStack[at]!) as Skin, { commit: false });
  updateHistoryButtons();
  persist();
}
const b64 = {
  enc: (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))),
};
function shareUrl() {
  return `${location.href.split('#')[0]}#skin=${b64.enc(JSON.stringify(state.skin))}`;
}
function persist() {
  if (pendingUpdate) return afterUpdate(persist);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.skin));
  } catch {
    /* storage unavailable: fine */
  }
  try {
    window.history.replaceState(null, '', `#skin=${b64.enc(JSON.stringify(state.skin))}`);
  } catch {
    /* sandboxed frames may refuse: fine */
  }
}

/** Replaces the whole draft (preset, generator, undo) with an animated cross-fade. */
function load(skin: Skin, opts: { commit?: boolean; animate?: boolean } = {}) {
  const apply = () => {
    state.skin = clone(skin);
    state.palette = paletteFromTokens(skin.tokens ?? {}, skin.colorScheme ?? 'light');
    syncAll();
  };
  if (opts.animate === false) {
    apply();
    flush();
  } else animated(apply);
  if (opts.commit !== false) commit();
}

/* ============================================================== skin mutation helpers */

const tok = (name: string) => state.skin.tokens?.[name];
function setToken(name: string, value: string | number | undefined) {
  state.skin.tokens ??= {};
  if (value === undefined) delete state.skin.tokens[name];
  else state.skin.tokens[name] = value;
}
function roleSpec(role: Role): SkinElement | undefined {
  return state.skin.elements?.[role.tags[0]!];
}
function effectiveSpec(role: Role): SkinElement {
  return roleSpec(role) ?? state.skin.elements?.['*'] ?? {};
}
function setRoleSpec(role: Role, spec: SkinElement | undefined) {
  state.skin.elements ??= {};
  for (const t of role.tags) {
    if (spec) state.skin.elements[t] = clone(spec);
    else delete state.skin.elements[t];
  }
}
function editRole(role: Role, fn: (spec: SkinElement) => void) {
  const spec = clone(effectiveSpec(role));
  fn(spec);
  if (spec.vars && !Object.keys(spec.vars).length) delete spec.vars;
  setRoleSpec(role, spec);
}

/* ============================================================== controls */

type Sync = () => void;
const syncs: Sync[] = [];
const onSync = (fn: Sync) => {
  syncs.push(fn);
  return fn;
};
function syncAll() {
  for (const s of syncs) s();
}

interface SliderOpts {
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  get: () => number;
  set: (v: number) => void;
  /** Discrete settle after drag; default commits history. */
  live?: boolean;
}
function slider(o: SliderOpts) {
  const el = tr('tr-slider', { label: o.label, min: o.min, max: o.max, step: o.step, unit: o.unit ?? '', size: 'sm' });
  el.addEventListener('input', () => {
    o.set(Number(el.value));
    schedule();
  });
  el.addEventListener('change', () => {
    o.set(Number(el.value));
    schedule();
    commit();
  });
  onSync(() => {
    const v = o.get();
    if (Number(el.value) !== v) el.value = v;
  })();
  return el;
}

function select(label: string, options: [string, string][], get: () => string, set: (v: string) => void) {
  const el = tr('tr-select', { label, size: 'sm' });
  for (const [v, l] of options) el.append(tr('tr-option', { value: v, text: l }));
  el.addEventListener('change', () => {
    animated(() => {
      set(String(el.value));
      syncAll();
    });
    commit();
  });
  onSync(() => {
    const v = get();
    if (el.value !== v) el.value = v;
  })();
  return el;
}

function segmented(label: string, options: [string, string][], get: () => string, set: (v: string) => void) {
  const el = tr('tr-segmented', { label, size: 'sm', 'full-width': true });
  for (const [v, l] of options) el.append(tr('tr-option', { value: v, text: l }));
  el.addEventListener('change', () => {
    animated(() => {
      set(String(el.value));
      syncAll();
    });
    commit();
  });
  onSync(() => {
    const v = get();
    if (el.value !== v) el.value = v;
  })();
  return el;
}

/** A colour row: swatch with native picker, oklch text, live contrast against a background. */
function colorRow(o: { label: string; get: () => string | undefined; fallback: () => string; set: (v: string) => void; against?: () => { bg: string; min: number } | null }) {
  const input = h('input', { type: 'color', 'aria-label': `${o.label} colour` }) as HTMLInputElement;
  const swatch = h('span', { class: 'swatch-btn' }, input);
  const text = h('input', { class: 'color-value', spellcheck: 'false', 'aria-label': `${o.label} value` }) as HTMLInputElement;
  const ratio = h('span', { class: 'ratio' });
  const row = h('div', { class: 'color-row' }, swatch, h('div', { class: 'color-meta' }, h('span', { class: 'color-label', text: o.label }), text), ratio);
  const show = () => {
    const v = o.get() ?? o.fallback();
    const c = parseColor(v);
    swatch.style.setProperty('--c', c ? toHex(c) : 'transparent');
    if (document.activeElement !== text) text.value = v;
    if (c && document.activeElement !== input) input.value = toHex(c);
    const a = o.against?.();
    const bg = a ? parseColor(a.bg) : null;
    if (a && c && bg) {
      const r = contrastBetween(c, bg);
      ratio.textContent = `${r.toFixed(1)}:1`;
      ratio.toggleAttribute('data-fail', r < a.min);
      ratio.title = `Needs ${a.min}:1`;
    } else ratio.textContent = '';
  };
  input.addEventListener('input', () => {
    const c = parseColor(input.value);
    if (!c) return;
    o.set(formatOklch(c));
    show();
    schedule();
  });
  input.addEventListener('change', () => commit());
  text.addEventListener('change', () => {
    if (!parseColor(text.value)) {
      toast('Use oklch(), #hex or rgb()');
      show();
      return;
    }
    o.set(text.value.trim());
    show();
    schedule();
    commit();
  });
  onSync(show)();
  return row;
}
const contrastBetween = (a: ReturnType<typeof parseColor> & object, b: ReturnType<typeof parseColor> & object) => contrastFn(a, b, parseColor(String(tok('color.canvas') ?? '')) ?? undefined);

const group = (title: string | null, ...kids: (Node | null)[]) => h('section', { class: 'group' }, title ? h('h3', { class: 'group-title', text: title }) : null, ...kids);
const more = (title: string, ...kids: Node[]) => h('details', { class: 'more' }, h('summary', { text: title }), group(null, ...kids));
const hint = (text: string) => h('p', { class: 'hint', text });

/* ============================================================== rail */

interface Panel {
  id: string;
  label: string;
  icon: string;
  build: () => HTMLElement[];
}

const PANELS: Panel[] = [
  { id: 'describe', label: 'Describe', icon: 'spark', build: buildDescribe },
  { id: 'light', label: 'Light', icon: 'sun', build: buildLight },
  { id: 'colour', label: 'Colour', icon: 'drop', build: buildColour },
  { id: 'materials', label: 'Materials', icon: 'cube', build: buildMaterials },
  { id: 'shape', label: 'Shape', icon: 'shape', build: buildShape },
  { id: 'motion', label: 'Motion', icon: 'wave', build: buildMotion },
  { id: 'check', label: 'Check', icon: 'check', build: buildCheck },
];

function buildRail() {
  const tabs = $('#rail-tabs');
  const panels = $('#rail-panels');
  for (const p of PANELS) {
    const tab = h('button', { class: 'rail-tab', role: 'tab', id: `tab-${p.id}`, 'aria-controls': `panel-${p.id}`, type: 'button' }, svgIcon(p.icon, 20), h('span', { text: p.label }));
    tab.addEventListener('click', () => showPanel(p.id));
    tabs.append(tab);
    const panel = h('section', { class: 'rail-panel', role: 'tabpanel', id: `panel-${p.id}`, 'aria-labelledby': `tab-${p.id}` }, ...p.build());
    panels.append(panel);
  }
  tabs.addEventListener('keydown', (e) => {
    const i = PANELS.findIndex((p) => p.id === state.panel);
    const k = (e as KeyboardEvent).key;
    const d = k === 'ArrowDown' || k === 'ArrowRight' ? 1 : k === 'ArrowUp' || k === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = PANELS[(i + d + PANELS.length) % PANELS.length]!;
    showPanel(next.id);
    $(`#tab-${next.id}`).focus();
  });
  showPanel(state.panel);
}
function showPanel(id: string) {
  state.panel = id;
  for (const p of PANELS) {
    const tab = $(`#tab-${p.id}`);
    tab.setAttribute('aria-selected', String(p.id === id));
    tab.tabIndex = p.id === id ? 0 : -1;
    $(`#panel-${p.id}`).toggleAttribute('data-active', p.id === id);
  }
}

/* ---------- describe ---------- */
function buildDescribe() {
  const area = h('textarea', { id: 'describe-text', rows: 4, placeholder: 'e.g. walnut panels with brushed brass controls, amber accent, low evening light, serif type', 'aria-label': 'Describe a style' }) as HTMLTextAreaElement;
  const notes = h('ul', { class: 'notes', id: 'describe-notes', 'aria-live': 'polite' });
  const go = tr('tr-button', { tone: 'accent' }, svgIcon('spark'), 'Generate skin');
  go.firstElementChild?.setAttribute('slot', 'start');
  const dice = tr('tr-button', { 'aria-label': 'Surprise me', title: 'Surprise me' }, svgIcon('dice'));
  const run = (text: string) => {
    if (!text.trim()) {
      toast('Describe a look first, or pick an example');
      area.focus();
      return;
    }
    const { skin, notes: n } = skinFromDescription(text);
    load(skin);
    notes.replaceChildren(...n.map((line, i) => h('li', { style: `--i:${i}`, text: line })));
    nameInput.value = skin.name;
  };
  go.addEventListener('click', () => run(area.value));
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(area.value);
  });
  dice.addEventListener('click', () => {
    area.value = surprise();
    run(area.value);
  });
  const ex = h(
    'div',
    { class: 'examples' },
    ...EXAMPLES.map((e) => {
      const b = h('button', { class: 'example', type: 'button', text: e.prompt });
      b.addEventListener('click', () => {
        area.value = e.prompt;
        run(e.prompt);
      });
      return b;
    }),
  );
  return [
    h('h2', { class: 'panel-title', text: 'Describe a look' }),
    h('p', { class: 'panel-lede', text: 'Write what it should look and feel like: materials, colours, light, shape, type, motion. You get a complete, contrast-checked skin you can then refine by hand.' }),
    h('div', { class: 'describe-box' }, area, h('div', { class: 'describe-actions' }, go, dice)),
    group('How it was read', notes),
    group('Try one', ex),
  ];
}
function surprise() {
  const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;
  const surfaces = materialPresets.filter((p) => p.use.surfaces && p.family !== 'glass');
  const controls = materialPresets.filter((p) => p.use.controls && (p.family === 'metal' || p.family === 'plastic'));
  const s = pick(surfaces);
  let c = pick(controls);
  if (c.id === s.id) c = pick(controls);
  return `${pick(['', 'dark ', 'light ', ''])}${s.keywords[0]} panels with ${c.keywords[0]} controls, ${pick(['amber', 'teal', 'coral', 'cobalt', 'emerald', 'magenta', 'mustard', 'red'])} accent, ${pick(['morning', 'evening', 'dramatic', 'softbox', 'overhead'])} light, ${pick(['rounded', 'sharp', 'soft', 'crisp'])}, ${pick(['serif', 'mono', 'geometric', 'rounded', 'humanist'])} type, ${pick(['snappy', 'calm', 'bouncy', 'heavy'])}`.replace(/\s+/g, ' ');
}

/* ---------- light ---------- */
function buildLight() {
  const pad = h('div', { class: 'light-pad', tabindex: 0, role: 'application', 'aria-label': 'Light position. Drag the sun, or use arrow keys: left and right turn it, up and down raise and lower it.' });
  const ball = h('div', { class: 'light-ball' });
  const sun = h('div', { class: 'light-sun' });
  const readout = h('p', { class: 'light-readout' });
  pad.append(ball, sun);
  const angle = () => num(tok('light.angle'), 330);
  const elev = () => num(tok('light.elevation'), 55);
  const draw = () => {
    const a = (angle() * Math.PI) / 180;
    const r = 1 - (elev() - 10) / 80; // 10° = rim, 90° = centre
    const sx = Math.sin(a) * r;
    const sy = -Math.cos(a) * r;
    pad.style.setProperty('--sx', String(sx));
    pad.style.setProperty('--sy', String(sy));
    ball.style.setProperty('--bx', String(sx));
    ball.style.setProperty('--by', String(sy));
    ball.style.setProperty('--bl', String(0.4 + r));
    readout.textContent = `${Math.round(angle())}° · ${Math.round(elev())}° high`;
  };
  const setFrom = (x: number, y: number) => {
    const rect = pad.getBoundingClientRect();
    const dx = (x - rect.left) / rect.width - 0.5;
    const dy = (y - rect.top) / rect.height - 0.5;
    const r = Math.min(1, Math.hypot(dx, dy) * 2);
    let a = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (a < 0) a += 360;
    setToken('light.angle', `${Math.round(a)}deg`);
    setToken('light.elevation', `${Math.round(10 + (1 - r) * 80)}deg`);
    retexture();
    draw();
    syncAll();
    schedule();
  };
  pad.addEventListener('pointerdown', (e) => {
    pad.setPointerCapture(e.pointerId);
    setFrom(e.clientX, e.clientY);
  });
  pad.addEventListener('pointermove', (e) => {
    if (pad.hasPointerCapture(e.pointerId)) setFrom(e.clientX, e.clientY);
  });
  pad.addEventListener('pointerup', () => commit());
  pad.addEventListener('keydown', (e) => {
    const k = e.key;
    const step = e.shiftKey ? 10 : 2;
    if (k === 'ArrowLeft' || k === 'ArrowRight') setToken('light.angle', `${(angle() + (k === 'ArrowRight' ? step : -step) + 360) % 360}deg`);
    else if (k === 'ArrowUp' || k === 'ArrowDown') setToken('light.elevation', `${Math.min(90, Math.max(10, elev() + (k === 'ArrowUp' ? step : -step)))}deg`);
    else return;
    e.preventDefault();
    retexture();
    draw();
    syncAll();
    schedule();
    commit();
  });
  onSync(draw)();

  return [
    h('h2', { class: 'panel-title', text: 'Light and depth' }),
    h('p', { class: 'panel-lede', text: 'One light lights every surface. Drag the sun: around the rim turns it, toward the centre raises it.' }),
    group(null, pad, readout),
    group(
      'Light',
      slider({ label: 'Direction', min: 0, max: 359, step: 1, unit: '°', get: angle, set: (v) => (setToken('light.angle', `${v}deg`), retexture(), draw()) }),
      slider({ label: 'Height', min: 10, max: 90, step: 1, unit: '°', get: elev, set: (v) => (setToken('light.elevation', `${v}deg`), retexture(), draw()) }),
      slider({ label: 'Reflection tilt', min: 120, max: 240, step: 1, unit: '°', get: () => num(tok('light.environment'), 180), set: (v) => setToken('light.environment', `${v}deg`) }),
    ),
    group(
      'Realism and depth',
      slider({ label: 'Realism', min: 0, max: 100, step: 1, unit: '%', get: () => Math.round(num(tok('realism.default'), 0.65) * 100), set: (v) => setToken('realism.default', v / 100) }),
      hint('0% is flat colour. 100% is full material: highlights, reflections, textures and cast shadows.'),
      slider({ label: 'Depth unit', min: 0.5, max: 5, step: 0.25, unit: 'px', get: () => num(tok('depth.unit'), 2), set: (v) => setToken('depth.unit', `${v}px`) }),
      slider({ label: 'Depth curve', min: 1, max: 2.4, step: 0.05, get: () => num(tok('depth.curve'), 1.6), set: (v) => setToken('depth.curve', Number(v.toFixed(2))) }),
    ),
  ];
}

/** Textures bake the light direction into their relief; regenerate them when the light moves. */
let retexTimer = 0;
function retexture() {
  clearTimeout(retexTimer);
  retexTimer = window.setTimeout(() => {
    // compileSkin reads light from tokens at compile time; nothing to store, just recompile.
    schedule();
  }, 60);
}

/* ---------- colour ---------- */
const COLOR_TOKENS: [string, string, (() => { bg: string; min: number } | null) | null][] = [
  ['color.canvas', 'Canvas', null],
  ['color.surface', 'Surface', null],
  ['color.well', 'Well', null],
  ['color.ink', 'Ink', () => ({ bg: colorOf('color.surface'), min: 4.5 })],
  ['color.ink-muted', 'Muted ink', () => ({ bg: colorOf('color.surface'), min: 4.5 })],
  ['color.edge', 'Edge', () => ({ bg: colorOf('color.canvas'), min: 3 })],
  ['color.accent', 'Accent', null],
  ['color.accent-ink', 'Accent ink', () => ({ bg: colorOf('color.accent'), min: 4.5 })],
  ['color.danger', 'Danger', null],
  ['color.danger-ink', 'Danger ink', () => ({ bg: colorOf('color.danger'), min: 4.5 })],
  ['color.focus', 'Focus ring', () => ({ bg: colorOf('color.canvas'), min: 3 })],
  ['color.shadow', 'Shadow', null],
];
function colorOf(name: string): string {
  const own = tok(name);
  if (own !== undefined) return String(own);
  const p = paletteTokens(state.palette);
  return p[name] ?? '#888';
}
function regeneratePalette() {
  const p = paletteTokens(state.palette);
  for (const [k, v] of Object.entries(p)) setToken(k, v);
}
function buildColour() {
  const pal = (key: keyof PaletteInput) => ({
    get: () => Number(state.palette[key] ?? 0),
    set: (v: number) => {
      (state.palette as unknown as Record<string, number>)[key] = v;
      regeneratePalette();
      syncAll();
    },
  });
  return [
    h('h2', { class: 'panel-title', text: 'Colour' }),
    h('p', { class: 'panel-lede', text: 'Set the intent and the palette follows. Every readable pair is kept at WCAG contrast as you move.' }),
    group(
      'Scheme',
      segmented(
        'Colour scheme',
        [
          ['light', 'Light'],
          ['dark', 'Dark'],
        ],
        () => state.skin.colorScheme ?? 'light',
        (v) => {
          state.skin.colorScheme = v as 'light' | 'dark';
          state.palette.scheme = v as 'light' | 'dark';
          regeneratePalette();
        },
      ),
    ),
    group(
      'Harmony',
      slider({ label: 'Neutral hue', min: 0, max: 359, step: 1, unit: '°', ...pal('hue') }),
      slider({ label: 'Neutral tint', min: 0, max: 1, step: 0.01, ...pal('tint') }),
      slider({ label: 'Accent hue', min: 0, max: 359, step: 1, unit: '°', ...pal('accentHue') }),
      slider({ label: 'Accent strength', min: 0, max: 0.3, step: 0.005, ...pal('accentChroma') }),
      slider({ label: 'Crispness', min: 0, max: 1, step: 0.01, ...pal('crispness') }),
    ),
    more(
      'Every colour token',
      ...COLOR_TOKENS.map(([name, label, against]) =>
        colorRow({
          label,
          get: () => (tok(name) === undefined ? undefined : String(tok(name))),
          fallback: () => colorOf(name),
          set: (v) => setToken(name, v),
          against: against ?? undefined,
        }),
      ),
      hint('Moving a harmony slider regenerates these. Hand edits stay until then.'),
    ),
  ];
}

/* ---------- materials ---------- */
let swatchSync: Sync = () => {};
function buildMaterials() {
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Which controls to edit' });
  const note = h('p', { class: 'role-note' });
  for (const r of ROLES) {
    const c = h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false', 'data-role': r.id, text: r.label });
    c.addEventListener('click', () => selectRole(r.id));
    chips.append(c);
  }
  onSync(() => {
    for (const c of chips.children) {
      const r = ROLES.find((x) => x.id === (c as HTMLElement).dataset.role)!;
      c.setAttribute('aria-pressed', String(r.id === state.role));
      c.toggleAttribute('data-custom', r.id !== 'base' && !!roleSpec(r));
    }
    const r = currentRole();
    note.textContent =
      r.id === 'base' ? 'The default for every control. Specific groups override it.' : roleSpec(r) ? `Custom for ${r.tags.join(', ')}.` : `Follows “Everything”. Pick a material to make ${r.label.toLowerCase()} different.`;
  });

  // Material library: real-world recipes rendered with the engine itself.
  const lib = h('div', { class: 'swatches' });
  const tiles: { el: HTMLElement; id: string }[] = [];
  for (const p of materialPresets) {
    const mini = tr('tr-panel', { depth: 1, material: p.spec.material, finish: p.spec.finish, ...(p.spec.profile ? { profile: p.spec.profile } : {}) });
    const style = [...Object.entries(p.spec.vars ?? {}).map(([k, v]) => `${k}:${v}`), ...(p.spec.texture ? textureDeclarations(p.spec.texture).map((d) => d.replace(/;$/, '')) : [])];
    mini.setAttribute('style', style.join(';'));
    const tile = h('button', { class: 'swatch', type: 'button', 'aria-pressed': 'false', title: p.description }, mini, h('span', { class: 'swatch-label', text: p.label }));
    tile.addEventListener('click', () => {
      const role = currentRole();
      animated(() => {
        const spec = presetSpec(p.id)!;
        const prev = roleSpec(role);
        if (prev?.style) spec.style = prev.style;
        setRoleSpec(role, spec);
        syncAll();
      });
      commit();
    });
    tiles.push({ el: tile, id: p.id });
    lib.append(tile);
  }
  swatchSync = onSync(() => {
    const spec = effectiveSpec(currentRole());
    const key = JSON.stringify({ m: spec.material, f: spec.finish, t: spec.texture, b: spec.vars?.['--tr-m-base'] });
    for (const t of tiles) {
      const p = materialPresets.find((x) => x.id === t.id)!;
      t.el.setAttribute('aria-pressed', String(JSON.stringify({ m: p.spec.material, f: p.spec.finish, t: p.spec.texture, b: p.spec.vars?.['--tr-m-base'] }) === key));
    }
  });

  const r = () => currentRole();
  const spec = () => effectiveSpec(r());
  const varNum = (name: string, d: number) => () => num(spec().vars?.[name], d);
  const setVar = (name: string) => (v: number | string) => editRole(r(), (s) => ((s.vars ??= {})[name] = String(v)));
  const texName = () => {
    const t = spec().texture;
    return !t ? 'none' : typeof t === 'string' ? t : t.name;
  };
  const texOpt = (k: 'scale' | 'strength', d: number) => () => {
    const t = spec().texture;
    return typeof t === 'object' && t[k] !== undefined ? t[k]! : d;
  };
  const setTexOpt = (k: 'scale' | 'strength') => (v: number) =>
    editRole(r(), (s) => {
      const name = texName();
      if (name === 'none') return;
      const cur = typeof s.texture === 'object' ? s.texture : { name: name as Exclude<SkinTexture, 'none' | object> };
      s.texture = { ...cur, [k]: v } as SkinTexture;
    });

  const reset = tr('tr-button', { size: 'sm' }, 'Follow “Everything”');
  reset.addEventListener('click', () => {
    const role = r();
    if (role.id === 'base') return;
    animated(() => {
      setRoleSpec(role, undefined);
      syncAll();
    });
    commit();
  });
  onSync(() => (reset.disabled = r().id === 'base' || !roleSpec(r())));

  return [
    h('h2', { class: 'panel-title', text: 'Materials' }),
    h('p', { class: 'panel-lede', text: 'Choose what each kind of control is made of. Tip: turn on Inspect above the preview and click any control.' }),
    group('Edit', chips, note),
    group('Library', lib),
    group(
      'Substance',
      select('Material', materials.map((m) => [m, m[0]!.toUpperCase() + m.slice(1)]), () => spec().material ?? 'plastic', (v) => editRole(r(), (s) => (s.material = v as SkinElement['material']))),
      select('Finish', finishes.map((m) => [m, m[0]!.toUpperCase() + m.slice(1)]), () => spec().finish ?? 'satin', (v) => editRole(r(), (s) => (s.finish = v as SkinElement['finish']))),
      select('Profile', [['', 'Natural shape'], ...profiles.map((m) => [m, m[0]!.toUpperCase() + m.slice(1)] as [string, string])], () => spec().profile ?? '', (v) => editRole(r(), (s) => (v ? (s.profile = v as SkinElement['profile']) : delete s.profile))),
      select('Texture', [['none', 'None'], ...textures.map((t) => [t, t[0]!.toUpperCase() + t.slice(1)] as [string, string])], texName, (v) => editRole(r(), (s) => (v === 'none' ? delete s.texture : (s.texture = v as SkinTexture)))),
      slider({ label: 'Texture scale', min: 0.25, max: 3, step: 0.05, unit: '×', get: texOpt('scale', 1), set: setTexOpt('scale') }),
      slider({ label: 'Texture strength', min: 0, max: 1, step: 0.01, get: texOpt('strength', 0.45), set: setTexOpt('strength') }),
    ),
    group(
      'Colour',
      colorRow({ label: 'Base', get: () => spec().vars?.['--tr-m-base'], fallback: () => colorOf('color.surface'), set: (v) => setVar('--tr-m-base')(v) }),
      colorRow({ label: 'Ink on it', get: () => spec().vars?.['--tr-m-ink'], fallback: () => colorOf('color.ink'), set: (v) => setVar('--tr-m-ink')(v), against: () => ({ bg: spec().vars?.['--tr-m-base'] ?? colorOf('color.surface'), min: 4.5 }) }),
    ),
    more(
      'Fine-tune the surface',
      slider({ label: 'Specular', min: 0, max: 1, step: 0.01, get: varNum('--tr-m-specular', 0.55), set: setVar('--tr-m-specular') }),
      slider({ label: 'Roughness', min: 0, max: 1, step: 0.01, get: varNum('--tr-m-roughness', 0.5), set: setVar('--tr-m-roughness') }),
      slider({ label: 'Metalness', min: 0, max: 1, step: 0.01, get: varNum('--tr-m-metalness', 0), set: setVar('--tr-m-metalness') }),
      slider({ label: 'Clear coat', min: 0, max: 1, step: 0.01, get: varNum('--tr-m-gloss', 0), set: setVar('--tr-m-gloss') }),
      slider({ label: 'Mirror', min: 0, max: 1, step: 0.01, get: varNum('--tr-m-mirror', 0), set: setVar('--tr-m-mirror') }),
      slider({ label: 'Brushed', min: 0, max: 1, step: 0.01, get: varNum('--tr-m-brush', 0), set: setVar('--tr-m-brush') }),
      slider({ label: 'Grain', min: 0, max: 0.3, step: 0.005, get: varNum('--tr-m-grain', 0.04), set: setVar('--tr-m-grain') }),
      slider({ label: 'Translucency', min: 0, max: 1, step: 0.01, get: varNum('--tr-m-translucency', 0), set: setVar('--tr-m-translucency') }),
      slider({ label: 'Edge highlight', min: 0, max: 3, step: 0.25, unit: 'px', get: varNum('--tr-m-bevel', 1), set: (v) => setVar('--tr-m-bevel')(`${v}px`) }),
      hint('Finish values win over these when a finish is set; choose “Satin” or “Matte” to let them show.'),
    ),
    group(null, reset),
  ];
}
const currentRole = () => ROLES.find((r) => r.id === state.role) ?? ROLES[0]!;
function selectRole(id: string) {
  state.role = id;
  syncAll();
  swatchSync();
}

/* ---------- shape and type ---------- */
const FONT_CHOICES: [string, string][] = [
  ['ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif', 'System sans'],
  ['Inter, Roboto, "Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial, sans-serif', 'Neo-grotesque'],
  ['Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif', 'Humanist'],
  ['Avenir, Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif', 'Geometric'],
  ['ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manjari, "Arial Rounded MT", "Arial Rounded MT Bold", Calibri, source-sans-pro, sans-serif', 'Rounded'],
  ['Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif', 'Transitional serif'],
  ['Didot, "Bodoni MT", "Noto Serif Display", "URW Palladio L", P052, Sylfaen, serif', 'Didone'],
  ['ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace', 'Monospace'],
];
function buildShape() {
  const px = (name: string, d: number) => () => num(tok(name), d);
  const setPx = (name: string) => (v: number) => setToken(name, `${v}px`);
  const btn = ROLES.find((r) => r.id === 'buttons')!;
  const pill = tr('tr-switch', { size: 'sm' }, 'Pill-shaped buttons');
  pill.addEventListener('change', () => {
    animated(() => {
      editRole(btn, (s) => {
        s.style ??= {};
        if (pill.checked) s.style['--tr-button-radius'] = '999px';
        else delete s.style['--tr-button-radius'];
        if (!Object.keys(s.style).length) delete s.style;
      });
    });
    commit();
  });
  onSync(() => (pill.checked = roleSpec(btn)?.style?.['--tr-button-radius'] === '999px'));
  const fontSelect = select('Typeface', FONT_CHOICES, () => String(tok('font.family') ?? FONT_CHOICES[0]![0]), (v) => setToken('font.family', v));
  return [
    h('h2', { class: 'panel-title', text: 'Shape and type' }),
    h('p', { class: 'panel-lede', text: 'Corner radii, control size and typography for every component.' }),
    group(
      'Corners',
      slider({
        label: 'Roundness',
        min: 0,
        max: 2.5,
        step: 0.05,
        unit: '×',
        get: () => Number((num(tok('radius.md'), 10) / 10).toFixed(2)),
        set: (v) => {
          setToken('radius.sm', `${Math.round(6 * v)}px`);
          setToken('radius.md', `${Math.round(10 * v)}px`);
          setToken('radius.lg', `${Math.round(16 * v)}px`);
          syncAll();
        },
      }),
      slider({ label: 'Small', min: 0, max: 24, step: 1, unit: 'px', get: px('radius.sm', 6), set: setPx('radius.sm') }),
      slider({ label: 'Medium', min: 0, max: 32, step: 1, unit: 'px', get: px('radius.md', 10), set: setPx('radius.md') }),
      slider({ label: 'Large', min: 0, max: 48, step: 1, unit: 'px', get: px('radius.lg', 16), set: setPx('radius.lg') }),
      pill,
    ),
    group(
      'Size',
      slider({
        label: 'Control height',
        min: 2,
        max: 3.25,
        step: 0.05,
        unit: 'em',
        get: () => num(tok('control.md'), 2.5),
        set: (v) => {
          setToken('control.sm', `${(v - 0.25).toFixed(2)}em`);
          setToken('control.md', `${v.toFixed(2)}em`);
          setToken('control.lg', `${(v + 0.25).toFixed(2)}em`);
        },
      }),
    ),
    group(
      'Type',
      fontSelect,
      slider({ label: 'Regular weight', min: 300, max: 600, step: 10, get: () => num(tok('font.weight.regular'), 450), set: (v) => setToken('font.weight.regular', v) }),
      slider({ label: 'Strong weight', min: 500, max: 850, step: 10, get: () => num(tok('font.weight.strong'), 600), set: (v) => setToken('font.weight.strong', v) }),
      hint('Font stacks use fonts already on the device, so skins never download anything.'),
    ),
  ];
}

/* ---------- motion ---------- */
const FEELS: [string, string][] = [
  ['natural', 'Natural'],
  ['snappy', 'Snappy'],
  ['calm', 'Calm'],
  ['bouncy', 'Bouncy'],
  ['heavy', 'Heavy'],
];
function buildMotion() {
  const feel = () => {
    const press = num(tok('motion.duration.press'), 70);
    const hit = Object.entries(motionFeels).find(([, m]) => m.press === press && `${m.release}ms` === String(tok('motion.duration.release')));
    return hit ? hit[0] : tok('motion.duration.press') === undefined ? 'natural' : '';
  };
  const ms = (name: string, d: number) => () => num(tok(name), d);
  const setMs = (name: string) => (v: number) => setToken(name, `${v}ms`);
  const demo = tr('tr-button', { size: 'sm' }, 'Play a demo in the preview');
  demo.addEventListener('click', playDemo);
  return [
    h('h2', { class: 'panel-title', text: 'Motion' }),
    h('p', { class: 'panel-lede', text: 'How controls press, release and travel. Reduced-motion users always get instant changes.' }),
    group(
      'Feel',
      segmented('Motion feel', FEELS, feel, (v) => {
        if (v === 'natural') {
          for (const k of ['motion.duration.press', 'motion.duration.release', 'motion.duration.travel', 'motion.easing.spring']) setToken(k, undefined);
          return;
        }
        const m = motionFeels[v]!;
        setToken('motion.duration.press', `${m.press}ms`);
        setToken('motion.duration.release', `${m.release}ms`);
        setToken('motion.duration.travel', `${m.travel}ms`);
        setToken('motion.easing.spring', m.easing);
      }),
      demo,
    ),
    group(
      'Timing',
      slider({ label: 'Press', min: 20, max: 200, step: 5, unit: 'ms', get: ms('motion.duration.press', 70), set: setMs('motion.duration.press') }),
      slider({ label: 'Release', min: 60, max: 400, step: 10, unit: 'ms', get: ms('motion.duration.release', 160), set: setMs('motion.duration.release') }),
      slider({ label: 'Travel', min: 80, max: 600, step: 10, unit: 'ms', get: ms('motion.duration.travel', 220), set: setMs('motion.duration.travel') }),
    ),
  ];
}
function playDemo() {
  showScreen('kit');
  const sw = frame.querySelectorAll<HTMLElement & { checked: boolean }>('.screen[data-screen="kit"] tr-switch');
  const seg = frame.querySelector<HTMLElement & { value: string }>('.screen[data-screen="kit"] tr-segmented');
  const values = ['left', 'center', 'right', 'center'];
  let i = 0;
  const tick = () => {
    sw.forEach((s) => (s.checked = !s.checked));
    if (seg) seg.value = values[i % values.length]!;
    if (++i < 4) setTimeout(tick, 520);
  };
  setTimeout(tick, 300);
}

/* ---------- check ---------- */
function buildCheck() {
  const summary = h('div', { class: 'check-summary', id: 'check-summary' });
  const summaryText = h('p', { id: 'check-summary-text' });
  const fixAll = tr('tr-button', { size: 'sm', tone: 'accent' }, 'Fix contrast');
  fixAll.addEventListener('click', () => {
    const { skin, changed } = fixContrast(state.skin);
    if (!changed.length) return;
    animated(() => {
      state.skin = skin;
      syncAll();
    });
    commit();
    toast(`Adjusted ${changed.length} colour${changed.length > 1 ? 's' : ''}`);
  });
  summary.append(summaryText, fixAll);
  const pairs = h('div', { class: 'pairs', id: 'check-pairs' });
  const findings = h('ul', { class: 'findings', id: 'check-findings' });
  const cmd = h('code', { class: 'code-inline', id: 'check-cmd' });
  return [
    h('h2', { class: 'panel-title', text: 'Check' }),
    h('p', { class: 'panel-lede', text: 'The same rules trompe check runs in CI: format, vocabulary and WCAG contrast, live.' }),
    group(null, summary),
    group('Contrast', pairs),
    group('Format and vocabulary', findings),
    group('In your project', cmd, hint('Exit code 0 means the skin is ready to ship.')),
  ];
}
let lastCheck = '';
function refreshChecks() {
  const key = JSON.stringify(state.skin);
  if (key === lastCheck) return;
  lastCheck = key;
  const all = validateSkin(state.skin);
  const errors = all.filter((f) => f.severity === 'error');
  const pill = $('#check-pill');
  pill.dataset.state = errors.length ? 'bad' : 'ok';
  $('#check-text').textContent = errors.length ? `${errors.length} issue${errors.length > 1 ? 's' : ''}` : all.length ? 'Passes, notes' : 'Checks pass';
  const summary = $('#check-summary');
  summary.toggleAttribute('data-bad', errors.length > 0);
  $('#check-summary-text').textContent = errors.length ? `${errors.length} problem${errors.length > 1 ? 's' : ''} to fix before shipping.` : 'Ready to ship: every pair is readable and every name is valid.';
  const canvasColor = parseColor(colorOf('color.canvas'));
  $('#check-pairs').replaceChildren(
    ...contrastReport({ ...state.skin, tokens: { ...paletteTokens(state.palette), ...(state.skin.tokens ?? {}) } }).map((r) => {
      const fg = colorOf(r.fg);
      const bg = colorOf(r.bg);
      const sample = h('span', { class: 'pair-sample', text: 'Aa' });
      sample.style.color = toHex(parseColor(fg) ?? canvasColor!);
      sample.style.background = toHex(parseColor(bg) ?? canvasColor!);
      const ratio = h('span', { class: 'ratio', text: `${r.ratio.toFixed(1)}:1` });
      if (r.ratio < r.min) ratio.setAttribute('data-fail', '');
      return h('div', { class: 'pair-row' }, sample, h('span', { class: 'pair-name' }, h('span', { text: `${r.fg.slice(6)} on ${r.bg.slice(6)}` }), h('small', { text: `${r.why}, needs ${r.min}:1` })), ratio);
    }),
  );
  $('#check-findings').replaceChildren(...all.filter((f) => !f.path.startsWith('tokens.color')).map((f) => h('li', { 'data-severity': f.severity, text: f.message })));
  $('#check-cmd').textContent = `npx trompe check skins/${state.skin.name}.skin.json`;
}

/* ============================================================== stage */

function buildStage() {
  $('#sprite').outerHTML = SPRITE;
  const picker = $('#screen-picker');
  for (const s of SCREENS) {
    picker.append(tr('tr-option', { value: s.id, text: s.label }));
    const el = h('div', { class: 'screen', 'data-screen': s.id, html: s.html });
    frame.append(el);
  }
  (picker as HTMLElement & { value: string }).value = state.screen;
  picker.addEventListener('change', () => showScreen((picker as HTMLElement & { value: string }).value));
  showScreen(state.screen);
  for (const f of frame.querySelectorAll('form')) f.addEventListener('submit', (e) => e.preventDefault());
  for (const a of frame.querySelectorAll('tr-nav-item')) a.addEventListener('click', (e) => e.preventDefault());

  const device = $('#device') as HTMLElement & { value: string };
  device.addEventListener('change', () => animated(() => (frame.dataset.device = device.value), 'device'));
  const backdrop = $('#backdrop') as HTMLElement & { pressed: boolean };
  backdrop.addEventListener('change', () => (canvas.dataset.backdrop = backdrop.pressed ? 'mesh' : 'plain'));
  setupInspector();
}
function showScreen(id: string) {
  state.screen = id;
  const picker = $('#screen-picker') as HTMLElement & { value: string };
  if (picker.value !== id) picker.value = id;
  for (const s of frame.querySelectorAll<HTMLElement>('.screen')) s.toggleAttribute('data-active', s.dataset.screen === id);
}

/* ---------- inspector ---------- */
function setupInspector() {
  const btn = $('#inspect') as HTMLElement & { pressed: boolean };
  const box = $('#inspect-box');
  const tag = $('#inspect-tag');
  let on = false;
  let target: HTMLElement | null = null;
  const set = (v: boolean) => {
    on = v;
    btn.pressed = v;
    canvas.toggleAttribute('data-inspect', v);
    if (!v) box.removeAttribute('data-on');
  };
  btn.addEventListener('click', () => set(!on));
  const pick = (e: Event): HTMLElement | null => {
    for (const n of e.composedPath()) {
      if (n === frame) return null;
      if (n instanceof HTMLElement && n.tagName.startsWith('TR-') && frame.contains(n)) return n;
    }
    return null;
  };
  const place = (el: HTMLElement) => {
    // Relative to the frame, then into the canvas's positioning box (which starts after any
    // scrollbar gutter, so the canvas's own rect would be off by the gutter width).
    const f = frame.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    box.style.setProperty('--x', `${r.left - f.left + frame.offsetLeft - 3}px`);
    box.style.setProperty('--y', `${r.top - f.top + frame.offsetTop - 3}px`);
    box.style.setProperty('--w', `${r.width + 6}px`);
    box.style.setProperty('--h', `${r.height + 6}px`);
    const role = roleOfTag(el.tagName);
    tag.textContent = `${el.tagName.toLowerCase()} · ${role.label}`;
    box.setAttribute('data-on', '');
  };
  canvas.addEventListener('pointermove', (e) => {
    if (!on) return;
    const t = pick(e);
    if (!t) {
      box.removeAttribute('data-on');
      target = null;
      return;
    }
    if (t !== target) {
      target = t;
      place(t);
    }
  });
  canvas.addEventListener('scroll', () => target && on && place(target), { passive: true });
  canvas.addEventListener(
    'click',
    (e) => {
      if (!on) return;
      const t = pick(e);
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      const role = roleOfTag(t.tagName);
      selectRole(role.id);
      showPanel('materials');
      box.removeAttribute('data-flash');
      void box.offsetWidth;
      box.setAttribute('data-flash', '');
      toast(`Editing ${role.label.toLowerCase()}`);
    },
    true,
  );
  canvas.addEventListener('pointerdown', (e) => on && pick(e) && e.stopPropagation(), true);
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (e.key === 'i' && !e.metaKey && !e.ctrlKey && !/INPUT|TEXTAREA/.test(t.tagName) && !t.isContentEditable && !t.closest('tr-input,tr-textarea')) set(!on);
    if (e.key === 'Escape' && on) set(false);
  });
}

/* ============================================================== top bar */

let nameInput!: HTMLInputElement;
function buildTop() {
  const start = $('#start-from') as HTMLElement & { value: string };
  const opts: [string, string, Skin][] = [...builtIns.map((s) => [`skin:${s.name}`, `${s.name[0]!.toUpperCase()}${s.name.slice(1)} (built-in)`, s] as [string, string, Skin]), ...EXAMPLES.map((e, i) => [`ex:${e.id}`, e.label, examples[i]!] as [string, string, Skin])];
  for (const [v, l] of opts) start.append(tr('tr-option', { value: v, text: l }));
  start.addEventListener('change', () => {
    const hit = opts.find(([v]) => v === start.value);
    if (!hit) return;
    load(hit[2]);
    nameInput.value = state.skin.name;
    toast(`Started from ${hit[1].replace(' (built-in)', '')}`);
  });

  nameInput = $('#skin-name') as HTMLInputElement;
  nameInput.addEventListener('input', () => {
    const clean = nameInput.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    if (clean !== nameInput.value) nameInput.value = clean;
    state.skin.name = clean || 'custom';
    refreshChecks();
  });
  nameInput.addEventListener('change', () => commit());
  onSync(() => {
    if (document.activeElement !== nameInput) nameInput.value = state.skin.name;
  });

  $('#undo').addEventListener('click', () => travel(-1));
  $('#redo').addEventListener('click', () => travel(1));
  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
    const t = e.target as HTMLElement;
    if (/INPUT|TEXTAREA/.test(t.tagName)) return;
    e.preventDefault();
    travel(e.shiftKey ? 1 : -1);
  });
  $('#check-pill').addEventListener('click', () => showPanel('check'));
  $('#share').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      toast('Link copied. It holds the whole skin.');
    } catch {
      toast('Copy blocked here. Use Export instead.');
    }
  });
  setupExport();
}

/* ---------- export ---------- */
function setupExport() {
  const sheet = $('#export-sheet') as HTMLDialogElement;
  const fmt = $('#export-format') as HTMLElement & { value: string };
  const code = $('#export-code');
  const note = $('#export-note');
  const files: Record<string, () => { text: string; file: string; mime: string; note: string }> = {
    json: () => ({ text: JSON.stringify(state.skin, null, 2) + '\n', file: `${state.skin.name}.skin.json`, mime: 'application/json', note: `Save as skins/${state.skin.name}.skin.json in a Trompe project. npm run tokens builds it into skins.css, and trompe check validates it.` }),
    css: () => ({ text: compileSkin(state.skin), file: `${state.skin.name}.css`, mime: 'text/css', note: `Ready-to-use CSS. Load it after Trompe and add data-tr-skin="${state.skin.name}" to any container.` }),
    usage: () => ({
      text: `<!-- 1. Trompe and your skin -->\n<script type="module" src="https://unpkg.com/trompe/dist/trompe.bundle.js"></script>\n<link rel="stylesheet" href="./${state.skin.name}.css" />\n\n<!-- 2. Apply it to any container -->\n<body data-tr-skin="${state.skin.name}">\n  <tr-panel>\n    <tr-input label="Email" type="email"></tr-input>\n    <tr-switch checked>Two-factor sign-in</tr-switch>\n    <tr-button tone="accent">Save</tr-button>\n  </tr-panel>\n</body>\n\n<!-- Or at runtime, from the JSON -->\n<script type="module">\n  import { applySkin } from 'trompe/skin';\n  const skin = await (await fetch('./${state.skin.name}.skin.json')).json();\n  applySkin(skin);\n  document.body.dataset.trSkin = skin.name;\n</script>\n`,
      file: `${state.skin.name}-usage.html`,
      mime: 'text/html',
      note: 'Two ways to use it: the compiled CSS, or the JSON applied at runtime with applySkin().',
    }),
    agent: () => ({
      text: `# Trompe skin "${state.skin.name}"\n\n${state.skin.description}\n\nRecreate or extend it from code:\n\n  import { skinFromDescription, validateSkin, compileSkin } from 'trompe/skin';\n\n  const { skin, notes } = skinFromDescription(${JSON.stringify(describeOf())});\n  // edit skin.tokens / skin.elements, then:\n  validateSkin(skin);   // [] when it is ready\n  compileSkin(skin);    // CSS\n\nFrom the command line:\n\n  npx trompe skin ${JSON.stringify(describeOf())} --name ${state.skin.name} --out skins/${state.skin.name}.skin.json\n  npx trompe check skins/${state.skin.name}.skin.json\n\nThe exact skin:\n\n${JSON.stringify(state.skin, null, 2)}\n`,
      file: `${state.skin.name}.agent.md`,
      mime: 'text/markdown',
      note: 'A brief an agent can act on: the plain-language seed, the API calls, and the exact skin.',
    }),
  };
  const render = () => {
    const f = files[fmt.value]!();
    code.setAttribute('data-swap', '');
    setTimeout(() => {
      code.innerHTML = highlight(f.text, fmt.value);
      note.textContent = f.note;
      code.removeAttribute('data-swap');
    }, reduceMotion.matches ? 0 : 120);
  };
  fmt.addEventListener('change', render);
  $('#export').addEventListener('click', () => {
    render();
    sheet.showModal();
  });
  $('#export-close').addEventListener('click', () => sheet.close());
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.close();
  });
  $('#export-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(files[fmt.value]!().text);
      toast('Copied');
    } catch {
      toast('Copy blocked here. Select the text instead.');
    }
  });
  $('#export-download').addEventListener('click', () => {
    const f = files[fmt.value]!();
    const a = h('a', { href: URL.createObjectURL(new Blob([f.text], { type: f.mime })), download: f.file });
    document.body.append(a);
    a.click();
    setTimeout(() => (URL.revokeObjectURL(a.getAttribute('href')!), a.remove()), 1000);
    toast(`Saved ${f.file}`);
  });
}
function describeOf() {
  const m = state.skin.description.match(/Generated from: “(.*)”/);
  return m ? m[1]! : state.skin.description;
}
function highlight(text: string, kind: string) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (kind === 'json') return esc.replace(/("(?:[^"\\]|\\.)*")(\s*:)?|\b(-?\d+(?:\.\d+)?)\b/g, (m, s, colon, n) => (s ? `<span class="${colon ? 'k' : 's'}">${s}</span>${colon ?? ''}` : n ? `<span class="n">${n}</span>` : m));
  if (kind === 'css') return esc.replace(/(\/\*[\s\S]*?\*\/)|(--[a-z0-9-]+)(?=:)/g, (m, c, v) => (c ? `<span class="c">${c}</span>` : v ? `<span class="k">${v}</span>` : m));
  return esc;
}

/* ============================================================== toasts */

function toast(text: string) {
  const host = $('#toasts');
  const t = h('div', { class: 'toast', text });
  host.append(t);
  while (host.children.length > 3) host.firstElementChild?.remove();
  setTimeout(() => {
    t.setAttribute('data-leaving', '');
    setTimeout(() => t.remove(), 320);
  }, 2400);
}

/* ============================================================== studio's own skin */

function installUiSkin() {
  const ui: Skin = {
    name: 'studio-ui',
    description: 'The Studio editor itself: graphite satin plastic, quiet realism, warm accent.',
    colorScheme: 'dark',
    tokens: {
      ...paletteTokens({ scheme: 'dark', hue: 260, tint: 0.25, accentHue: 62, accentChroma: 0.15, crispness: 0.55 }),
      'color.canvas': 'oklch(17% 0.008 260)',
      'color.surface': 'oklch(25% 0.008 260)',
      'realism.default': 0.55,
      'light.angle': '340deg',
      'radius.sm': '6px',
      'radius.md': '8px',
      'radius.lg': '12px',
    },
    elements: { '*': { material: 'plastic', finish: 'satin' } },
  };
  applySkin(ui);
}

/* ============================================================== boot */

function initialSkin(): Skin {
  const hash = location.hash.match(/skin=([A-Za-z0-9_-]+)/);
  if (hash) {
    try {
      return JSON.parse(b64.dec(hash[1]!)) as Skin;
    } catch {
      /* fall through */
    }
  }
  const d = location.hash.match(/describe=([^&]+)/);
  if (d) return skinFromDescription(decodeURIComponent(d[1]!)).skin;
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) return JSON.parse(saved) as Skin;
  } catch {
    /* ignore */
  }
  return clone(examples[0]!);
}

installUiSkin();
buildStage();
buildRail();
buildTop();
load(initialSkin(), { animate: false });
nameInput.value = state.skin.name;
updateHistoryButtons();
// Reveal once every element is upgraded and styled, so nothing visibly reflows on boot.
Promise.all([...new Set([...document.querySelectorAll('*')].map((e) => e.localName).filter((n) => n.startsWith('tr-')))].map((n) => customElements.whenDefined(n))).then(() =>
  requestAnimationFrame(() => requestAnimationFrame(() => $('#studio').setAttribute('data-ready', ''))),
);
