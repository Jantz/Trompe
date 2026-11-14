import { setTimeScale } from '../src/index.ts';
import { materials, finishes, profiles, depthLevels } from '../src/generated/tokens.js';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T | null;
const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

type Valued = HTMLElement & { value: number };
type Checkable = HTMLElement & { checked: boolean };

/* ---------- scene controls: one light for the whole page ---------- */
const angle = $<Valued>('#light-angle');
const elevation = $<Valued>('#light-elevation');
const realism = $<Valued>('#realism');

function applyLight() {
  if (angle) root.style.setProperty('--tr-light-angle', `${angle.value}deg`);
  if (elevation) root.style.setProperty('--tr-light-elevation', `${elevation.value}deg`);
}
angle?.addEventListener('input', applyLight);
elevation?.addEventListener('input', applyLight);

// Realism scales every scene relative to its skin's own realism, so 100% = as designed.
realism?.addEventListener('input', () => root.style.setProperty('--tr-realism-scale', String(realism.value / 100)));

let orbit = 0;
$('#animate-light')?.addEventListener('change', (e) => {
  cancelAnimationFrame(orbit);
  if (!(e.target as Checkable).checked || !angle) return;
  let last = performance.now();
  const tick = (t: number) => {
    angle.value = (angle.value + (t - last) * 0.03) % 360;
    last = t;
    applyLight();
    orbit = requestAnimationFrame(tick);
  };
  orbit = requestAnimationFrame(tick);
});

$('#theme-light')?.addEventListener('change', (e) => {
  root.dataset.trTheme = (e.target as Checkable).checked ? 'light' : 'dark';
});

/* ---------- forms never navigate away ---------- */
for (const form of document.querySelectorAll('form')) form.addEventListener('submit', (e) => e.preventDefault());

/* ---------- studio dashboard: bar chart ---------- */
const bars = $('#bars');
if (bars) {
  const data = [42, 58, 51, 66, 73, 61, 88, 79, 92, 70, 84, 96];
  bars.innerHTML = data.map((v) => `<span style="--h:${v}%"></span>`).join('');
}

/* ---------- chrome files: upload progress, menu and dialog ---------- */
const upload = $<Valued>('#upload');
let uploadTimer = 0;
function setAmbientMotion(on: boolean) {
  // Everything that moves by itself can be paused (WCAG 2.2.2); reduced motion starts paused.
  if (on) delete root.dataset.still;
  else root.dataset.still = '';
  $('#sync-led')?.toggleAttribute('blink', on);
  clearInterval(uploadTimer);
  if (on && upload) {
    uploadTimer = window.setInterval(() => {
      upload.value = upload.value >= 100 ? 8 : Math.min(100, upload.value + 2);
    }, 400);
  }
}
const motion = $<Checkable>('#motion');
if (motion) {
  motion.checked = !reduceMotion;
  motion.addEventListener('change', () => setAmbientMotion(motion.checked));
}
setAmbientMotion(!reduceMotion);
const dialog = $<HTMLElement & { show?: () => void; close?: () => void; open: boolean }>('#delete-dialog');
document.addEventListener('select', (e) => {
  const value = (e as CustomEvent).detail?.value ?? (e.target as HTMLElement & { value?: string }).value;
  if (value === 'delete' && dialog) {
    if (dialog.show) dialog.show();
    else dialog.open = true;
  }
});
for (const id of ['#delete-cancel', '#delete-confirm']) {
  $(id)?.addEventListener('click', () => {
    if (!dialog) return;
    if (dialog.close) dialog.close();
    else dialog.open = false;
    // Deleting closes the row's height while it fades, so the rows below slide up.
    if (id === '#delete-confirm') ($('#contract-row') as (HTMLElement & { dismiss?: () => Promise<void> }) | null)?.dismiss?.();
  });
}

/* New folder: the row opens into place instead of pushing the list down in one frame. */
let folders = 0;
$('#files-new')?.addEventListener('click', () => {
  const row = document.createElement('tr-list-item');
  row.innerHTML = `<svg slot="start" width="22" height="22"><use href="#i-folder"/></svg>${++folders === 1 ? 'Untitled folder' : `Untitled folder ${folders}`}<span slot="description">Empty</span><span slot="end">Now</span>`;
  $('#files-list')?.prepend(row);
});

/* Slow motion: every transition, animation, view transition and spring at a fifth of its speed. */
const SLOW = 0.2;
let slowFrame = 0;
const slowed = new WeakSet<Animation>();
function slowAll() {
  const all = [...document.getAnimations()];
  for (const el of document.querySelectorAll('*')) if (el.shadowRoot) all.push(...el.shadowRoot.getAnimations());
  for (const a of all) if (!slowed.has(a)) { slowed.add(a); a.playbackRate *= SLOW; }
  slowFrame = requestAnimationFrame(slowAll);
}
$('#slowmo')?.addEventListener('change', (e) => {
  const on = (e.target as Checkable).checked;
  setTimeScale(on ? SLOW : 1);
  cancelAnimationFrame(slowFrame);
  if (on) slowAll();
});

/* ---------- extras ---------- */
const knob = $<Valued>('#extra-knob');
const readout = $<HTMLElement & { value: string }>('#extra-readout');
knob?.addEventListener('input', () => {
  if (readout) readout.value = knob.value.toFixed(1);
});

/* ---------- primitives matrix ---------- */
const matrix = $('#matrix');
if (matrix) {
  const depthNames: Record<number, string> = { [-2]: 'well', [-1]: 'pressed', 0: 'flush', 1: 'raised', 2: 'lifted', 3: 'floating', 4: 'overlay' };
  const rows: Array<[string, string[]]> = [
    ['Materials', materials.map((m) => `<tr-panel class="swatch" material="${m}" depth="2">${m}</tr-panel>`)],
    ['Finishes on metal', finishes.map((f) => `<tr-panel class="swatch" material="metal" finish="${f}" depth="2">${f}</tr-panel>`)],
    [
      'Profiles',
      profiles.map((p) =>
        p === 'dome'
          ? `<tr-button shape="circle" profile="dome" finish="gloss" tone="accent" size="lg" aria-label="dome">●</tr-button>`
          : `<tr-button profile="${p}" size="lg">${p}</tr-button>`,
      ),
    ],
    ['Depth', depthLevels.map((d) => `<tr-panel class="swatch" depth="${d}">${d} ${depthNames[d]}</tr-panel>`)],
    ['Realism', ['flat', 'soft', 'tactile', 'real'].map((r) => `<tr-button realism="${r}" material="chrome" profile="bevel" size="lg">${r}</tr-button>`)],
  ];
  matrix.innerHTML = rows.map(([title, items]) => `<div><h3>${title}</h3><div class="matrix-row">${items.join('')}</div></div>`).join('');
}
