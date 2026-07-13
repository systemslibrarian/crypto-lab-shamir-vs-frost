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

// Show the 3 most load-bearing rows first; the rest are behind an expander so
// the learner interacts before absorbing the full vocabulary.
const INITIAL_ROWS = 3;

export function renderComparisonTable(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'section';

  const rowHtml = (r: typeof ROWS[number], hidden: boolean) => `
          <tr${hidden ? ' class="ct-extra" hidden' : ''}>
            <th scope="row">${escHtml(r.label)}</th>
            <td>${escHtml(r.shamir)}</td>
            <td>${escHtml(r.frost)}</td>
          </tr>`;

  section.innerHTML = `
    <h2 class="section-title">The Comparison, In Full</h2>
    <p class="section-subtitle">Now that you have watched both run, here is the whole side-by-side. The first three rows are the ones that matter most; expand for all seven dimensions.</p>
    <div class="card">
      <div class="ct-scroll" tabindex="0" role="region" aria-label="Shamir vs FROST comparison table">
      <table class="comparison-table" aria-label="Shamir vs FROST comparison">
        <thead>
          <tr>
            <th scope="col">Dimension</th>
            <th scope="col" class="col-shamir">⚠ Shamir SSS</th>
            <th scope="col" class="col-frost">✓ FROST</th>
          </tr>
        </thead>
        <tbody>
          ${ROWS.map((r, i) => rowHtml(r, i >= INITIAL_ROWS)).join('')}
        </tbody>
      </table>
      </div>
      <button type="button" class="btn btn-ghost ct-toggle" aria-expanded="false">Show all ${ROWS.length} dimensions</button>
    </div>
  `;

  const toggle = section.querySelector('.ct-toggle') as HTMLButtonElement;
  const extras = Array.from(section.querySelectorAll<HTMLTableRowElement>('.ct-extra'));
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    extras.forEach(tr => { tr.hidden = expanded; });
    toggle.setAttribute('aria-expanded', String(!expanded));
    toggle.textContent = expanded ? `Show all ${ROWS.length} dimensions` : 'Show fewer';
  });

  return section;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
