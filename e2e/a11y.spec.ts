import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Strict WCAG regression gate for the Shamir-vs-FROST threshold lab.
 *
 * The app (rendered by main.ts) is a single scrolling page — no tabs, no
 * <details>. Its interactive output regions (reconstructed-secret callouts,
 * FROST signatures, risk-scenario outcomes, participant grids, the attacker
 * overlays) are injected only after buttons are clicked. So we DRIVE every
 * live demo — Run both, Compromise, and each risk-scenario toggle — then
 * neutralize motion/opacity and scan the whole page. Both themes; WCAG 2.0/2.1
 * A + AA; asserts zero violations.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Neutralize animation/transition/opacity so mid-flight states (fade-in, and
// the opacity:0.4 "locked" steps) can't hide text from the contrast checker.
async function killMotion(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `*,*::before,*::after{
      animation-duration:0s!important;animation-delay:0s!important;
      transition-duration:0s!important;transition-delay:0s!important;
      opacity:1!important;scroll-behavior:auto!important;
    }`,
  });
}

// Generic reveal: open any <details> and un-hide anything [hidden] for robustness.
async function revealAll(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('details')) (d as HTMLDetailsElement).open = true;
    for (const el of document.querySelectorAll<HTMLElement>('[hidden]')) el.removeAttribute('hidden');
  });
}

// Drive every live demo so all dynamically-injected result regions exist and
// are painted when axe runs.
async function driveDemos(page: Page): Promise<void> {
  // Head-to-head: run both protocols end-to-end (Shamir reconstruct+sign,
  // FROST distribute+commit+sign) so the badges, verdict strip, share grid,
  // participant grids, poly viz, and all callouts render.
  await page.locator('button:has-text("Run both")').click();
  await expect(page.locator('.share-grid .share-card').first()).toBeVisible();
  await expect(page.locator('.panel-frost .participant-grid .participant-card').first()).toBeVisible();
  // Wait for the Shamir HMAC (async) verdict + FROST signature to settle.
  await expect(page.locator('.vc-shamir')).toContainText('YES');
  await expect(page.locator('.panel-frost .mono-box').first()).toBeVisible();

  // Compromise a machine — reveals the attacker overlay callouts in both panels.
  await page.locator('button:has-text("Compromise a machine")').click();
  await expect(page.locator('.panel-shamir .callout-danger, .panel-shamir .callout-info').first()).toBeVisible();

  // Risk scenarios: drive the slider past threshold + toggle both simulate
  // buttons so every callout / participant grid variant is injected.
  const slider = page.locator('input[aria-label="Number of shares stolen"]');
  await slider.fill('4');
  await slider.dispatchEvent('input');
  await page.locator('button:has-text("Simulate reconstruction interception")').click();
  await page.locator('button:has-text("Compromise Participant 2")').click();
  await expect(page.locator('.risk-grid .participant-grid .participant-card').first()).toBeVisible();
}

async function scan(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
  }));
  expect(summary).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#cl-theme-toggle')).toBeVisible();
  await expect(page.locator('#app h1')).toBeVisible();
  await killMotion(page);
});

test('no WCAG A/AA violations in dark theme (all demos driven)', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await driveDemos(page);
  await killMotion(page);
  await revealAll(page);
  await scan(page);
});

test('no WCAG A/AA violations in light theme (all demos driven)', async ({ page }) => {
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await driveDemos(page);
  await killMotion(page);
  await revealAll(page);
  await scan(page);
});
