import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

test.describe('tr-slider', () => {
  test('exposes slider role, name, value and orientation', async ({ page }) => {
    await mount(page, `<tr-slider label="Volume" value="60" unit="%"></tr-slider><tr-slider label="Fader" orientation="vertical" value="20"></tr-slider>`);
    const h = page.getByRole('slider', { name: 'Volume' });
    await expect(h).toHaveAttribute('aria-valuenow', '60');
    await expect(h).toHaveAttribute('aria-valuetext', '60%');
    await expect(h).toHaveAttribute('aria-orientation', 'horizontal');
    await expect(page.getByRole('slider', { name: 'Fader' })).toHaveAttribute('aria-orientation', 'vertical');
  });

  test('keyboard follows the APG slider pattern', async ({ page }) => {
    await mount(page, `<tr-slider label="Gain" min="-12" max="12" step="0.5" value="0"></tr-slider>`);
    const s = page.getByRole('slider', { name: 'Gain' });
    await s.focus();
    await page.keyboard.press('ArrowRight');
    await expect(s).toHaveAttribute('aria-valuenow', '0.5');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(s).toHaveAttribute('aria-valuenow', '-0.5');
    await page.keyboard.press('PageDown');
    await expect(s).toHaveAttribute('aria-valuenow', '-3');
    await page.keyboard.press('End');
    await expect(s).toHaveAttribute('aria-valuenow', '12');
    await page.keyboard.press('Home');
    await expect(s).toHaveAttribute('aria-valuenow', '-12');
  });

  test('pointer: click on the slot jumps, dragging the cap keeps its grip', async ({ page }) => {
    await mount(page, `<div style="width:400px"><tr-slider id="s" label="Level" value="0" hide-value></tr-slider></div>`);
    await page.evaluate(() => {
      const w = window as any;
      w.changes = 0;
      document.getElementById('s')!.addEventListener('change', () => w.changes++);
    });
    const track = (await page.locator('#s .track').boundingBox())!;
    await page.mouse.click(track.x + track.width - 2, track.y + track.height / 2);
    expect(await page.evaluate(() => (document.getElementById('s') as any).value)).toBe(100);
    expect(await page.evaluate(() => (window as any).changes)).toBe(1);

    await page.mouse.click(track.x + track.width / 2, track.y + track.height / 2);
    expect(await page.evaluate(() => (document.getElementById('s') as any).value)).toBe(50);

    // the value jumps at once; the cap glides there on a spring, so wait for it to land
    await expect(page.locator('#s')).toHaveAttribute('data-tr-state', 'idle');

    // grab the cap slightly off-centre and move it: the value moves by the distance, not to the pointer
    const cap = (await page.locator('#s .thumb').boundingBox())!;
    const x = cap.x + cap.width - 3;
    await page.mouse.move(x, cap.y + cap.height / 2);
    await page.mouse.down();
    await page.mouse.move(x + (track.width - cap.width) * 0.2, cap.y + cap.height / 2, { steps: 4 });
    await page.mouse.up();
    expect(await page.evaluate(() => (document.getElementById('s') as any).value)).toBe(70);
  });

  test('vertical faders increase upwards and line up in a flex row', async ({ page }) => {
    await mount(
      page,
      `<div id="bank" style="display:flex;gap:12px">
        <tr-slider id="a" orientation="vertical" label="A" hide-value value="0"></tr-slider>
        <tr-slider id="b" orientation="vertical" label="B" hide-value value="50"></tr-slider>
        <tr-slider id="c" orientation="vertical" label="C" hide-value value="100"></tr-slider>
      </div>`,
    );
    const boxes = await Promise.all(['a', 'b', 'c'].map((id) => page.locator(`#${id} .track`).boundingBox()));
    expect(boxes[0]!.y).toBe(boxes[1]!.y);
    expect(boxes[1]!.y).toBe(boxes[2]!.y);
    expect(boxes[0]!.x + boxes[0]!.width).toBeLessThan(boxes[1]!.x);
    const capA = (await page.locator('#a .thumb').boundingBox())!;
    const capC = (await page.locator('#c .thumb').boundingBox())!;
    expect(capC.y).toBeLessThan(capA.y);
    const t = boxes[0]!;
    await page.mouse.click(t.x + t.width / 2, t.y + 2);
    expect(await page.evaluate(() => (document.getElementById('a') as any).value)).toBe(100);
  });

  test('renders printed scale marks in reading order', async ({ page }) => {
    await mount(page, `<tr-slider id="s" orientation="vertical" label="Gain" min="-12" max="12" marks="+12,0,-12"></tr-slider>`);
    const marks = page.locator('#s .mark');
    await expect(marks).toHaveText(['+12', '0', '-12']);
    const top = (await marks.nth(0).boundingBox())!.y;
    const bottom = (await marks.nth(2).boundingBox())!.y;
    expect(top).toBeLessThan(bottom);
    await expect(page.locator('#s .tick')).toHaveCount(3);
  });

  test('submits and resets with its form', async ({ page }) => {
    await mount(page, `<form id="f"><tr-slider name="vol" label="Vol" value="30"></tr-slider></form>`);
    const read = () => page.evaluate(() => new URLSearchParams(new FormData(document.getElementById('f') as HTMLFormElement) as any).toString());
    expect(await read()).toBe('vol=30');
    await page.getByRole('slider', { name: 'Vol' }).focus();
    await page.keyboard.press('End');
    expect(await read()).toBe('vol=100');
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    await expect(page.getByRole('slider', { name: 'Vol' })).toHaveAttribute('aria-valuenow', '30');
  });

  test('has no axe violations', async ({ page }) => {
    await mount(
      page,
      `<tr-slider label="Volume" value="40"></tr-slider>
       <tr-slider aria-label="Pan" marks="L,C,R"></tr-slider>
       <tr-slider label="Fader" orientation="vertical" ticks="5" marks="+12,0,-12"></tr-slider>`,
    );
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: fader bank and horizontal sliders', async ({ page }) => {
    const block = `<div style="display:flex;gap:28px;padding:12px;align-items:flex-start;background:var(--tr-color-canvas);color:var(--tr-color-ink)">
      <div style="display:flex;gap:10px">
        <tr-slider orientation="vertical" label="Kick" value="80" hide-value min="-24" max="12" marks="+12,+6,0,-6,-12,-24" material="rubber"></tr-slider>
        <tr-slider orientation="vertical" label="Snare" value="40" hide-value ticks="7" material="rubber"></tr-slider>
        <tr-slider orientation="vertical" label="Hat" value="55" hide-value ticks="7"></tr-slider>
        <tr-slider orientation="vertical" label="Bus" value="20" hide-value ticks="7" material="metal"></tr-slider>
      </div>
      <div style="display:grid;gap:14px;width:280px">
        <tr-slider label="Volume" value="60" unit="%"></tr-slider>
        <tr-slider label="Pan" value="50" material="metal" marks="L,,C,,R"></tr-slider>
        <tr-slider label="Drive" value="30" material="chrome" size="lg"></tr-slider>
      </div></div>`;
    await mount(page, `${block}<div data-tr-theme="dark">${block}</div>`);
    await expect(page.locator('#root')).toHaveScreenshot('slider-matrix.png');
  });
});
