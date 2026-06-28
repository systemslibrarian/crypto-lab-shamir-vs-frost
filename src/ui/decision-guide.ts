// Decision guide — when to use Shamir vs FROST.
// [extension] Add post-quantum threshold scheme comparison card here (e.g., threshold Kyber / Dilithium).

export function renderDecisionGuide(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'section';

  section.appendChild(Object.assign(document.createElement('h2'), {
    className: 'section-title',
    textContent: 'Decision Guide',
  }));
  section.appendChild(Object.assign(document.createElement('p'), {
    className: 'section-subtitle',
    textContent: 'When is each approach the right tool?',
  }));

  const grid = document.createElement('div');
  grid.className = 'decision-grid';

  grid.appendChild(makeCard('dc-shamir', '⚠ Use Shamir when…', [
    'You need to backup or recover a static secret (e.g., BIP-39 seed phrase)',
    'Key recovery is the primary requirement — the secret must be reassembled',
    'You control the combiner environment and can limit the exposure window',
    'Operational simplicity outweighs the reconstruction risk',
    'The secret is accessed infrequently (cold storage, legal escrow)',
  ]));

  grid.appendChild(makeCard('dc-frost', '✓ Use FROST when…', [
    'You need threshold signing — multiple parties must authorize transactions',
    'The private key must never exist on any single machine',
    'High-value or continuously-used signing keys (hot wallets, signing services)',
    'You need resilience: any k-of-n can sign, even if some participants are offline',
    'You want signatures compatible with standard Ed25519 verifiers',
  ]));

  grid.appendChild(makeCard('dc-warn', '⚠ Pitfalls of Shamir', [
    'The combiner is a single point of failure during the reconstruction window',
    'Memory hygiene: the full key must be explicitly zeroed after use (not guaranteed by GC)',
    'Side-channel risk: swap files, cold-boot, memory scrapers during the exposure window',
    'Trusted combiner by design — if compromised at reconstruction time, the secret is gone',
    'Sharing a private key is categorically different from threshold signing',
  ]));

  grid.appendChild(makeCard('dc-warn', '⚠ Pitfalls of FROST', [
    'Two network rounds required — latency-sensitive use cases may prefer alternatives',
    'Trusted dealer required for basic setups (use DKG to eliminate this)',
    'Implementation complexity: binding factors, Lagrange coefficients, aggregation',
    'Nonce reuse is catastrophic — never reuse (d, e) nonce pairs across sessions',
    'All participants in the signing set must be online simultaneously',
  ]));

  section.appendChild(grid);

  const linkRow = document.createElement('div');
  linkRow.className = 'row mt';
  linkRow.style.marginTop = '1.5rem';

  const links = [
    { href: '/crypto-lab-shamir-visual/', text: '→ Shamir Visual Demo (deep dive)' },
    { href: '/crypto-lab-frost-threshold/', text: '→ FROST Threshold Demo (deep dive)' },
  ];

  for (const { href, text } of links) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'btn btn-ghost';
    linkRow.appendChild(a);
  }

  section.appendChild(linkRow);
  return section;
}

function makeCard(cls: string, title: string, items: string[]): HTMLElement {
  const card = document.createElement('div');
  card.className = `decision-card ${cls}`;

  const h = document.createElement('div');
  h.className = 'decision-card-title';
  h.textContent = title;
  card.appendChild(h);

  const ul = document.createElement('ul');
  for (const item of items) {
    ul.appendChild(Object.assign(document.createElement('li'), { textContent: item }));
  }
  card.appendChild(ul);
  return card;
}
