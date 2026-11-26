import { expect, test, type Page } from '@playwright/test';

/**
 * Functional gate for the claims the two panels make: the key badges, the
 * partial-sum aggregation, and — the load-bearing one — the real Ed25519
 * verification result on both the success and the failure path.
 *
 * Every assertion here is on something the page computed in the browser.
 */

const shamir = (page: Page) => page.locator('.panel-shamir');
const frost = (page: Page) => page.locator('.panel-frost');

async function distributeAndCommit(page: Page): Promise<void> {
  await frost(page).getByRole('button', { name: 'Distribute Key' }).click();
  await expect(frost(page).locator('.participant-grid .participant-card').first()).toBeVisible();
  await frost(page).getByRole('button', { name: 'Generate Commitments' }).click();
  await expect(frost(page).locator('[role="checkbox"]').first()).toBeVisible();
}

// The signer cards are the checkbox-role participant cards in step 3.
const signerCards = (page: Page) => frost(page).locator('[role="checkbox"]');

test.beforeEach(async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#app h1')).toBeVisible();
});

test('FROST rejects a k-1 signature and accepts the k-th, on the same code path', async ({ page }) => {
  await distributeAndCommit(page);

  // k = 3 by default; select two and sign anyway.
  await signerCards(page).nth(0).click();
  await signerCards(page).nth(1).click();

  const signBtn = frost(page).locator('button', { hasText: 'Sign' });
  await expect(signBtn).toBeEnabled();
  await expect(signBtn).toHaveText('Sign anyway (2 of k=3)');
  await signBtn.click();

  const result = frost(page).locator('div[role="status"][aria-live="polite"]').first();
  await expect(result).toContainText('Rejected.');
  await expect(result).toContainText('ed25519.verify() against the group public key');
  await expect(result).toContainText('returned false');
  await expect(result).not.toContainText('Signature valid');

  // Two partials really were produced and summed.
  await expect(frost(page).locator('.agg-chip')).toHaveCount(2);

  // Add the third signer and the identical path now verifies.
  await signerCards(page).nth(2).click();
  await expect(signBtn).toHaveText('Sign');
  await signBtn.click();

  await expect(result).toContainText('Signature valid');
  await expect(result).not.toContainText('Rejected.');
  await expect(frost(page).locator('.agg-chip')).toHaveCount(3);
});

test('repeated quorum signing uses fresh public commitments and clears obsolete message evidence', async ({ page }) => {
  await distributeAndCommit(page);
  const panel = frost(page);
  for (let i = 0; i < 3; i++) await signerCards(page).nth(i).click();
  const commitment = panel.getByText('Participant 1 commitment D', { exact: false }).locator('..').locator('.mono-box span');
  const before = await commitment.textContent();
  const sign = panel.getByRole('button', { name: 'Sign', exact: true });
  const result = panel.locator('div[role="status"][aria-live="polite"]').first();
  await sign.click();
  await expect(result).toContainText('Signature valid');
  await expect(commitment).toHaveText(before!);
  await sign.click();
  await expect(result).toContainText('Signature valid');
  await expect(commitment).not.toHaveText(before!);
  await panel.locator('input[type="text"]').fill('  classroom message  ');
  await expect(result).toBeEmpty();
  await sign.click();
  await expect(result).toContainText('Signature valid');
});

test('the aggregate is the running sum of k partial signatures', async ({ page }) => {
  await distributeAndCommit(page);
  for (let i = 0; i < 3; i++) await signerCards(page).nth(i).click();
  await frost(page).locator('button', { hasText: 'Sign' }).click();

  const chips = frost(page).locator('.agg-chip');
  await expect(chips).toHaveCount(3);
  await expect(chips.nth(0)).toContainText('z_1 =');
  await expect(chips.nth(2)).toContainText('z_3 =');

  // The running sum ticks up from 0 to a real scalar.
  const sum = frost(page).locator('.agg-sum-val');
  await expect(sum).not.toHaveText('0');
  await expect(sum).toContainText('…');

  // And the signature that sum belongs to verifies.
  await expect(frost(page).locator('div[role="status"]').first()).toContainText('Signature valid');
});

test('the key badges report what each protocol actually did', async ({ page }) => {
  // Shamir: neutral until the secret is assembled, then a warning.
  await expect(shamir(page).locator('.key-badge')).toHaveText('○ Awaiting operation');
  await expect(frost(page).locator('.key-badge')).toHaveText('✓ Key never reconstructed');

  await shamir(page).getByRole('button', { name: 'Split Secret' }).click();
  const shareCards = shamir(page).locator('.share-card');
  await expect(shareCards).toHaveCount(5);
  for (let i = 0; i < 3; i++) await shareCards.nth(i).click();
  await shamir(page).locator('button', { hasText: 'Reconstruct' }).click();

  await expect(shamir(page).locator('.key-badge')).toHaveText('⚠ Private key in memory');
  await expect(page.locator('.vc-shamir')).toContainText('YES — it sat in memory');

  // FROST: a full signing run leaves the badge alone.
  await distributeAndCommit(page);
  for (let i = 0; i < 3; i++) await signerCards(page).nth(i).click();
  await frost(page).locator('button', { hasText: 'Sign' }).click();
  await expect(frost(page).locator('div[role="status"]').first()).toContainText('Signature valid');
  await expect(frost(page).locator('.key-badge')).toHaveText('✓ Key never reconstructed');
  await expect(page.locator('.vc-frost')).toContainText('NO — never assembled');
});

test('the same two shares can match by chance or miss, and only the third resolves the secret', async ({ page }) => {
  const panel = shamir(page);
  for (const { secret, coeffs, verdict } of [
    { secret: 'A', coeffs: [7, 0], verdict: 'matches by chance' },
    { secret: 'C', coeffs: [4, 1], verdict: 'no match' },
  ]) {
    await page.locator('#shamir-secret').fill(secret);
    // Fix the two classroom polynomial coefficients for this one click only.
    await panel.getByRole('button', { name: 'Split Secret' }).evaluate((button, coefficients) => {
      const rng = crypto.getRandomValues;
      crypto.getRandomValues = function<T extends ArrayBufferView | null>(buf: T): T {
        if (buf instanceof Uint8Array && buf.length === 2) { buf.set(coefficients); return buf; }
        return rng.call(crypto, buf) as T;
      };
      try { (button as HTMLButtonElement).click(); } finally { crypto.getRandomValues = rng; }
    }, coeffs);
    const cards = panel.locator('.share-card');
    await expect(cards.nth(0)).toContainText('46');
    await expect(cards.nth(1)).toContainText('4f');
    await cards.nth(0).click();
    await cards.nth(1).click();
    const reconstruct = panel.getByRole('button', { name: /Reconstruct/ });
    await expect(reconstruct).toHaveText('Reconstruct anyway (2 of k=3)');
    await reconstruct.click();
    const result = panel.locator('div[role="status"][aria-live="polite"]').first();
    await expect(result).toContainText(verdict);
    await expect(result).toContainText('What 2 shares actually interpolate to');
    await expect(result.locator('.mono-box span')).toHaveText('41');
    await expect(panel.locator('.key-badge')).toHaveText('○ Awaiting operation');
    await expect(page.locator('.vc-shamir')).toContainText('NO — never assembled');
    await cards.nth(2).click();
    await reconstruct.click();
    await expect(result).toContainText('byte-for-byte match');
    await expect(result.locator('.mono-box span')).toHaveText(secret);
    await expect(panel.locator('.key-badge')).toHaveText('⚠ Private key in memory');
  }
});

test('the compromise control makes the attacker actually try to sign', async ({ page }) => {
  await page.locator('button:has-text("Run both")').click();
  await expect(page.locator('.vc-shamir')).toContainText('YES');
  await expect(frost(page).locator('div[role="status"]').first()).toContainText('Signature valid');

  await page.locator('button:has-text("Compromise a machine")').click();

  // FROST: the attacker signs with a real stolen share and the verifier rejects it.
  const frostAttack = frost(page).locator('div[role="status"]').last();
  await expect(frostAttack).toContainText('has their real signing share');
  await expect(frostAttack).toContainText('returned false');
  await expect(frostAttack).not.toContainText('ACCEPTED');
  // A real 64-byte signature was produced — 128 hex characters.
  const sigText = await frostAttack.locator('.mono-box span').first().innerText();
  expect(sigText.trim()).toMatch(/^[0-9a-f]{128}$/);

  // Shamir: the same compromise hands over the whole secret.
  await expect(shamir(page).locator('.callout-danger').first()).toContainText('correct horse battery');
});

test('the FROST risk card runs the forgery and the honest quorum', async ({ page }) => {
  await page.locator('button:has-text("Compromise Participant 2")').click();

  const card = page.locator('.risk-card').filter({ hasText: 'FROST: one participant compromised' });
  await expect(card).toContainText("real signing share s_2");
  await expect(card).toContainText('ed25519.verify() returned false');
  await expect(card).toContainText('ed25519.verify() returned true');
  await expect(card).not.toContainText('ACCEPTED the solo signature');

  // The forged signature shown is a real 64-byte value.
  const hex = await card.locator('code.font-mono').first().innerText();
  expect(hex.trim()).toMatch(/^[0-9a-f]{128}$/);

  await expect(card.locator('.participant-card')).toHaveCount(5);
  await expect(card.locator('.participant-card.compromised')).toHaveCount(1);
});
