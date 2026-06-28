// Static 7-row side-by-side comparison table: Shamir vs FROST.

const ROWS: Array<{ label: string; shamir: string; frost: string; tip: string }> = [
  {
    label: 'Primary goal',
    shamir: 'Protect a static secret (split, later recover)',
    frost: 'Produce a threshold signature without ever assembling the key',
    tip: 'Shamir SSS and FROST solve fundamentally different problems.',
  },
  {
    label: 'What gets split',
    shamir: 'The raw secret bytes — a seed phrase, symmetric key, or private key scalar',
    frost: 'The private signing key scalar into additive shares in Z_ℓ',
    tip: 'In both cases a polynomial is used, but the field and purpose differ.',
  },
  {
    label: 'Reconstruction required?',
    shamir: 'Yes — the secret must be fully assembled to be used',
    frost: 'No — signing never reconstructs the key; each signer uses only their share',
    tip: 'This is the critical architectural difference.',
  },
  {
    label: 'Final output',
    shamir: 'The original secret bytes (e.g., a private key or seed)',
    frost: 'A compact Ed25519 signature indistinguishable from a single-party signature',
    tip: 'A FROST signature is a standard 64-byte Ed25519 signature.',
  },
  {
    label: 'Attack surface',
    shamir: 'The reconstruction step exposes the full secret to whoever runs it',
    frost: 'No single point in the protocol ever holds the full key',
    tip: 'With Shamir, the combiner is a single point of failure during use.',
  },
  {
    label: 'Best real-world use',
    shamir: 'Seed phrase backup, key escrow, cold storage split',
    frost: 'Multisig wallets, HSM replacement, distributed signing services',
    tip: 'Use Shamir when you need to recover; use FROST when you need to sign.',
  },
  {
    label: 'Relative complexity',
    shamir: 'Low — one polynomial, one reconstruction step',
    frost: 'Higher — two network rounds, binding factors, aggregation',
    tip: 'FROST complexity is the price of avoiding key reconstruction.',
  },
];

export function renderComparisonTable(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'section';

  section.innerHTML = `
    <h2 class="section-title">Quick Comparison</h2>
    <p class="section-subtitle">Seven dimensions that reveal why these protocols are fundamentally different tools.</p>
    <div class="card" style="overflow-x:auto">
      <table class="comparison-table" aria-label="Shamir vs FROST comparison">
        <thead>
          <tr>
            <th scope="col">Dimension</th>
            <th scope="col" class="col-shamir">⚠ Shamir SSS</th>
            <th scope="col" class="col-frost">✓ FROST</th>
          </tr>
        </thead>
        <tbody>
          ${ROWS.map(r => `
          <tr>
            <td title="${escHtml(r.tip)}">${escHtml(r.label)}</td>
            <td>${escHtml(r.shamir)}</td>
            <td>${escHtml(r.frost)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  return section;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
