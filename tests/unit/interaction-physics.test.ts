import { describe, expect, it } from 'vitest';
import { Spring, springEasing, springs, stepSpring } from '../../src/interaction/spring.js';
import { applyDetents, detentIndex, restingPoint } from '../../src/interaction/detents.js';
import { rubberBand } from '../../src/interaction/drag-surface.js';
import { renderProfile, soundProfiles } from '../../src/interaction/feedback.js';

describe('spring', () => {
  it('is frame-rate independent (analytic)', () => {
    const a = new Spring(0, 'press');
    const b = new Spring(0, 'press');
    a.target = b.target = 1;
    for (let i = 0; i < 30; i++) a.step(1 / 60);
    for (let i = 0; i < 60; i++) b.step(1 / 120);
    expect(a.value).toBeCloseTo(b.value, 6);
  });

  it('settles exactly on target', () => {
    const s = new Spring(0, 'glide');
    s.target = 10;
    let t = 0;
    while (s.step(1 / 60) && t < 600) t++;
    expect(s.value).toBe(10);
    expect(s.velocity).toBe(0);
    expect(t).toBeLessThan(60);
  });

  it('bounce 0 never overshoots, bounce > 0 does', () => {
    const c = { w: (2 * Math.PI) / 0.3, z: 1 };
    let max = -1;
    for (let i = 1; i < 400; i++) {
      const [x] = stepSpring(-1, 0, i / 1000, c);
      max = Math.max(max, x);
    }
    expect(max).toBeLessThanOrEqual(1e-9);
    const e = springEasing(springs.press);
    expect(e.easing).toMatch(/^linear\(0, /);
    const ys = [...e.easing.matchAll(/(-?\d+(?:\.\d+)?) \d/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeGreaterThan(1);
  });

  it('keeps velocity when retargeted', () => {
    const s = new Spring(0, 'settle');
    s.target = 1;
    s.step(0.05);
    const v = s.velocity;
    s.target = 2;
    expect(s.velocity).toBe(v);
  });

  it('bakes compact CSS easings', () => {
    for (const name of Object.keys(springs) as Array<keyof typeof springs>) {
      const e = springEasing(name);
      expect(e.duration).toBeGreaterThan(50);
      expect(e.duration).toBeLessThan(1500);
      // Adaptive points: compact enough for a token, dense enough to be accurate.
      expect(e.easing.split(',').length).toBeLessThan(40);
      expect(e.easing.endsWith(', 1)')).toBe(true);
    }
  });
});

describe('detents', () => {
  const r = { min: 0, max: 10, step: 1 };
  it('sticks near a notch and is continuous at zone edges', () => {
    const spec = { positions: 'steps' as const, strength: 1, width: 0 };
    expect(applyDetents(3.2, spec, r)).toBeLessThan(3.01);
    expect(applyDetents(3.4999, spec, r)).toBeCloseTo(3.5, 2);
    expect(applyDetents(3.5001, spec, r)).toBeCloseTo(3.5, 2);
  });
  it('strength 0 is linear', () => {
    expect(applyDetents(3.2, { positions: 'steps', strength: 0, width: 0 }, r)).toBe(3.2);
  });
  it('centre detent captures and releases', () => {
    const spec = { positions: [5], strength: 0.8, width: 0.5 };
    expect(applyDetents(5.2, spec, r)).toBeLessThan(5.05);
    expect(applyDetents(7, spec, r)).toBe(7);
    expect(restingPoint(5.2, spec, r)).toBe(5);
    expect(restingPoint(5.4, spec, r)).toBe(5.4);
    expect(detentIndex(4.9, spec, r)).not.toBe(detentIndex(5.1, spec, r));
  });
});

describe('rubber band', () => {
  it('resists more the further it is pulled and never exceeds the dimension', () => {
    const a = rubberBand(50, 400);
    const b = rubberBand(100, 400);
    expect(a).toBeGreaterThan(0);
    expect(b - a).toBeLessThan(a);
    expect(rubberBand(1e6, 400)).toBeLessThan(400);
    expect(rubberBand(-50, 400)).toBe(-a);
  });
});

describe('sound synthesis', () => {
  it('renders every profile deterministically, normalized, without clipping', () => {
    for (const p of soundProfiles) {
      if (p === 'slide') continue;
      const a = renderProfile(p, 0, 48000);
      const b = renderProfile(p, 0, 48000);
      expect(a).toEqual(b);
      let peak = 0;
      for (const s of a) {
        expect(Number.isFinite(s)).toBe(true);
        peak = Math.max(peak, Math.abs(s));
      }
      expect(peak).toBeGreaterThan(0.2);
      expect(peak).toBeLessThanOrEqual(1);
      expect(Math.abs(a[a.length - 1]!)).toBeLessThan(0.01);
    }
  });
  it('variants differ slightly', () => {
    expect(renderProfile('click', 0, 48000)).not.toEqual(renderProfile('click', 1, 48000));
  });
});

describe('motion tokens', () => {
  it('baked spring easings in the token file match the physics', async () => {
    const { readFileSync } = await import('node:fs');
    const json = JSON.parse(readFileSync(new URL('../../tokens/trompe.tokens.json', import.meta.url), 'utf8'));
    for (const [name, tok] of Object.entries<any>(json.motion.easing)) {
      const spring = tok.$extensions?.['dev.trompe']?.spring;
      if (!spring) continue;
      const e = springEasing(spring, { tolerance: 0.004 });
      expect(tok.$value, name).toBe(e.easing);
      expect(json.motion.duration[name].$value, name).toBe(`${e.duration}ms`);
    }
  });
});
