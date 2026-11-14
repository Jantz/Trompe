import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { mount } from './helpers';
import { scenarios } from './motion-scenarios';
// @ts-expect-error plain ESM module shared with the CLI
import { measureChange, motionProblems, MOTION_LIMITS } from '../cli/check/motion.mjs';

/**
 * Smoothness guard. Every state change in tests/motion-scenarios.ts must be animated (nothing
 * appears in the frame right after the change while animations are frozen) and must not shift
 * layout. See cli/check/motion.mjs for how the probe works.
 */
test.describe('motion: every change is animated and shift-free', () => {
  for (const s of scenarios) {
    test(s.name, async ({ page }) => {
      await page.setViewportSize({ width: 800, height: 600 });
      await mount(page, s.markup);
      if (s.setup) {
        await s.setup(page);
      }
      const dir = process.env.TROMPE_MOTION_FRAMES;
      const m = await measureChange(page, s.trigger, {
        wait: s.wait,
        mask: s.mask,
        clip: { x: 0, y: 0, width: 800, height: 600 },
        saveFrames: dir
          ? (f: Record<string, string>) => {
              const slug = s.name.replace(/[^a-z0-9]+/gi, '-');
              mkdirSync(dir, { recursive: true });
              for (const [k, v] of Object.entries(f)) writeFileSync(`${dir}/${slug}.${k}.png`, Buffer.from(v, 'base64'));
            }
          : undefined,
      });
      const problems: string[] = motionProblems(m, s.limits);
      if (process.env.TROMPE_MOTION_REPORT) console.log(JSON.stringify({ name: s.name, ...m, problems }));
      expect(problems, `${s.name}\n${JSON.stringify(m, null, 1)}`).toEqual([]);
    });
  }
});

test.describe('motion probe catches what is not animated', () => {
  const cases: Array<[string, string, (el: HTMLElement) => void]> = [
    ['a hue swap at the same brightness', '<div id="t" style="width:200px;height:80px;background:#cc3333"></div>', (el) => (el.style.background = '#3333cc')],
    ['text that appears at once', '<p id="t" style="font:16px sans-serif;width:300px;height:24px"></p>', (el) => (el.textContent = 'Saved to your library just now')],
  ];
  for (const [name, markup, change] of cases) {
    test(name, async ({ page }) => {
      await page.setViewportSize({ width: 800, height: 600 });
      await mount(page, markup);
      const m = await measureChange(page, (p) => p.evaluate(`(${change.toString()})(document.getElementById('t'))`), { clip: { x: 0, y: 0, width: 800, height: 600 } });
      expect(m.instant).toBeGreaterThan(MOTION_LIMITS.instant);
      expect(motionProblems(m).length).toBeGreaterThan(0);
    });
  }
});
