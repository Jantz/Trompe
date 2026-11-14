/**
 * Shared placement for Trompe's floating surfaces (menus, tooltips).
 *
 * Uses CSS anchor positioning (anchor-name / position-anchor / position-area with flip fallbacks)
 * where the browser supports it, and a small JS fallback otherwise that measures, flips to stay in
 * the viewport, clamps, and follows scroll and resize while the surface is open.
 */

/** Side of the anchor the floating surface sits on, optionally aligned to its start or end edge. */
export type Placement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'left-start'
  | 'left-end'
  | 'right'
  | 'right-start'
  | 'right-end';

/** Runtime switches. `css` is detected once; tests can set it to false to exercise the fallback. */
export const positioning = {
  css: typeof CSS !== 'undefined' && CSS.supports('anchor-name: --a') && CSS.supports('position-area: top'),
};

type Side = 'top' | 'bottom' | 'left' | 'right';
type Align = 'center' | 'start' | 'end';

function parse(placement: Placement): [Side, Align] {
  const [side, align] = placement.split('-') as [Side, Align | undefined];
  return [side, align ?? 'center'];
}

const AREA: Record<Side, Record<Align, string>> = {
  top: { center: 'top span-all', start: 'top span-right', end: 'top span-left' },
  bottom: { center: 'bottom span-all', start: 'bottom span-right', end: 'bottom span-left' },
  left: { center: 'left span-all', start: 'left span-bottom', end: 'left span-top' },
  right: { center: 'right span-all', start: 'right span-bottom', end: 'right span-top' },
};

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

let uid = 0;

/**
 * Places `floating` (a top-layer popover, position: fixed) next to `anchor`, and keeps it there
 * until the returned cleanup function is called. `offset` is the gap in px.
 */
export function anchorTo(floating: HTMLElement, anchor: Element, placement: Placement, offset = 6): () => void {
  const [side, align] = parse(placement);
  const s = floating.style;
  s.setProperty('inset', 'auto');
  s.setProperty('margin', '0');

  if (positioning.css && anchor instanceof HTMLElement) {
    const name = `--tr-anchor-${++uid}`;
    const prev = anchor.style.getPropertyValue('anchor-name');
    anchor.style.setProperty('anchor-name', prev && prev !== 'none' ? `${prev}, ${name}` : name);
    s.setProperty('position-anchor', name);
    s.setProperty('position-area', AREA[side][align]);
    // The gap sits on the side facing the anchor; flips mirror the margin with it.
    s.setProperty(`margin-${OPPOSITE[side]}`, `${offset}px`);
    const vertical0 = side === 'top' || side === 'bottom';
    if (align === 'center') s.setProperty(vertical0 ? 'justify-self' : 'align-self', 'anchor-center');
    const vertical = side === 'top' || side === 'bottom';
    s.setProperty(
      'position-try-fallbacks',
      vertical ? 'flip-block, flip-inline, flip-block flip-inline' : 'flip-inline, flip-block, flip-inline flip-block',
    );
    return () => {
      const names = (anchor.style.getPropertyValue('anchor-name') || '')
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n && n !== name);
      if (names.length) anchor.style.setProperty('anchor-name', names.join(', '));
      else anchor.style.removeProperty('anchor-name');
      for (const p of ['position-anchor', 'position-area', 'position-try-fallbacks', 'justify-self', 'align-self', `margin-${OPPOSITE[side]}`]) {
        s.removeProperty(p);
      }
    };
  }

  let frame = 0;
  const place = (): void => {
    frame = 0;
    const a = anchor.getBoundingClientRect();
    // Layout size: ignores entry-animation transforms.
    const f = { width: floating.offsetWidth, height: floating.offsetHeight };
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const pad = 4;
    let use = side;
    const room: Record<Side, number> = { top: a.top, bottom: vh - a.bottom, left: a.left, right: vw - a.right };
    const need = side === 'top' || side === 'bottom' ? f.height + offset : f.width + offset;
    if (room[side] < need && room[OPPOSITE[side]] > room[side]) use = OPPOSITE[side];
    let x: number;
    let y: number;
    if (use === 'top' || use === 'bottom') {
      y = use === 'top' ? a.top - offset - f.height : a.bottom + offset;
      x = align === 'start' ? a.left : align === 'end' ? a.right - f.width : a.left + (a.width - f.width) / 2;
      if (align === 'start' && x + f.width > vw - pad) x = a.right - f.width;
      if (align === 'end' && x < pad) x = a.left;
    } else {
      x = use === 'left' ? a.left - offset - f.width : a.right + offset;
      y = align === 'start' ? a.top : align === 'end' ? a.bottom - f.height : a.top + (a.height - f.height) / 2;
      if (align === 'start' && y + f.height > vh - pad) y = a.bottom - f.height;
      if (align === 'end' && y < pad) y = a.top;
    }
    x = Math.min(Math.max(pad, x), Math.max(pad, vw - f.width - pad));
    y = Math.min(Math.max(pad, y), Math.max(pad, vh - f.height - pad));
    s.setProperty('left', `${Math.round(x)}px`);
    s.setProperty('top', `${Math.round(y)}px`);
    floating.dataset.trSide = use;
  };
  const schedule = (): void => {
    if (!frame) frame = requestAnimationFrame(place);
  };
  place();
  addEventListener('scroll', schedule, { capture: true, passive: true });
  addEventListener('resize', schedule, { passive: true });
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
  ro?.observe(floating);
  return () => {
    cancelAnimationFrame(frame);
    removeEventListener('scroll', schedule, { capture: true });
    removeEventListener('resize', schedule);
    ro?.disconnect();
    s.removeProperty('left');
    s.removeProperty('top');
    delete floating.dataset.trSide;
  };
}

/** Places `floating` at a viewport point (context menus), flipping to stay on screen. */
export function placeAt(floating: HTMLElement, x: number, y: number): void {
  const s = floating.style;
  s.setProperty('inset', 'auto');
  s.setProperty('margin', '0');
  // Layout size: ignores entry-animation transforms.
    const f = { width: floating.offsetWidth, height: floating.offsetHeight };
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const left = x + f.width > vw - 4 ? Math.max(4, x - f.width) : x;
  const top = y + f.height > vh - 4 ? Math.max(4, y - f.height) : y;
  s.setProperty('left', `${Math.round(left)}px`);
  s.setProperty('top', `${Math.round(top)}px`);
}

/** Finds an element by id in the same tree as `from` (document or shadow root). */
export function byId(from: Node, id: string | null | undefined): HTMLElement | null {
  if (!id) return null;
  const root = from.getRootNode() as Document | ShadowRoot;
  return (root.getElementById?.(id) as HTMLElement | null) ?? null;
}

/** Ensures `el` has an id and returns it. */
export function ensureId(el: Element, prefix: string): string {
  if (!el.id) el.id = `${prefix}-${++uid}`;
  return el.id;
}
