import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mount } from './helpers';

const nav = `<tr-nav label="Main">
  <tr-nav-item href="#home" current>Home</tr-nav-item>
  <tr-nav-item href="#inbox">Inbox <tr-badge slot="badge" tone="accent">4</tr-badge></tr-nav-item>
  <tr-nav-item id="grp">Projects
    <tr-nav-item href="#alpha">Alpha</tr-nav-item>
    <tr-nav-item href="#beta">Beta</tr-nav-item>
  </tr-nav-item>
  <tr-nav-item id="act">Log out</tr-nav-item>
</tr-nav>`;

test.describe('tr-nav', () => {
  test('is a named navigation landmark with links and aria-current', async ({ page }) => {
    await mount(page, nav);
    const landmark = page.getByRole('navigation', { name: 'Main' });
    await expect(landmark).toBeVisible();
    const home = landmark.getByRole('link', { name: 'Home' });
    await expect(home).toHaveAttribute('aria-current', 'page');
    await expect(home).toHaveAttribute('href', '#home');
    expect(await landmark.getByRole('link', { name: /Inbox/ }).getAttribute('aria-current')).toBeNull();
    await expect(landmark.getByRole('button', { name: 'Log out' })).toBeVisible();
  });

  test('groups disclose nested items', async ({ page }) => {
    await mount(page, nav);
    const toggle = page.getByRole('button', { name: 'Projects' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('link', { name: 'Alpha' })).toBeHidden();
    await page.evaluate(() => {
      (window as any).toggles = 0;
      document.getElementById('grp')!.addEventListener('toggle', () => (window as any).toggles++);
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('link', { name: 'Alpha' })).toBeVisible();
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => (window as any).toggles)).toBe(2);
  });

  test('a group holding the current page starts open', async ({ page }) => {
    await mount(page, `<tr-nav label="Docs"><tr-nav-item>Guides<tr-nav-item href="#a" current>Start</tr-nav-item></tr-nav-item></tr-nav>`);
    await expect(page.getByRole('link', { name: 'Start' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guides' })).toHaveAttribute('aria-expanded', 'true');
  });

  test('Tab moves through items in order; links navigate', async ({ page }) => {
    await mount(page, nav);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Home' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /Inbox/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#inbox$/);
  });

  test('has no axe violations', async ({ page }) => {
    await mount(page, nav + `<tr-nav label="Top" orientation="horizontal" variant="flush"><tr-nav-item href="#a" current>A</tr-nav-item><tr-nav-item href="#b">B</tr-nav-item></tr-nav>`);
    const results = await new AxeBuilder({ page }).include('#root').analyze();
    expect(results.violations).toEqual([]);
  });

  test('visual: sidebar and top bar', async ({ page }) => {
    await mount(
      page,
      `<div style="display:flex;gap:20px;align-items:start">
        <div style="width:220px">${nav.replace('<tr-nav-item href="#alpha">', '<tr-nav-item href="#alpha" current>').replace('<tr-nav-item href="#home" current>', '<tr-nav-item href="#home">')}</div>
        <tr-nav label="Top" orientation="horizontal"><tr-nav-item href="#a" current>Overview</tr-nav-item><tr-nav-item href="#b">Activity</tr-nav-item><tr-nav-item href="#c">Settings</tr-nav-item></tr-nav>
      </div>`,
    );
    await expect(page.locator('#root')).toHaveScreenshot('nav-matrix.png');
  });
});
