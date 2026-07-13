// Inline glossary — dotted-underline terms with a one-line definition surfaced
// on hover AND focus (keyboard/tap accessible). Definitions are kept short and
// newcomer-facing; the deeper layers of the demo assume these, so we introduce
// them at first use instead of dropping them cold.

export const GLOSSARY: Record<string, string> = {
  'threshold (k of n)':
    'The rule "any k of the n shares are enough" — fewer than k reveal nothing, k or more fully reconstruct/sign.',
  'threshold':
    'The minimum number of shares (k) that must cooperate. Fewer than k learn nothing about the secret.',
  'Lagrange coefficient':
    'A fixed multiplier (λ) that weights each share so that combining exactly k of them lands on the value at x=0 — the classic "connect-the-dots" interpolation math.',
  'nonce':
    'A fresh random number used once per signature. Reusing one across two different messages leaks the private key, so each signing round draws a new one.',
  'commitment':
    'A public value you broadcast first (D_i, E_i) that pins down your secret nonce without revealing it — so nobody can adaptively cheat after seeing others.',
  'binding factor':
    'A per-signer hash (ρ_i) mixing the message and everyone’s commitments into each partial signature, so partials can only be combined for this exact message — this is what stops a class of forgery attacks.',
  'DKG':
    'Distributed Key Generation — the parties jointly create the key shares with no dealer, so the full private key is never assembled even at setup.',
  'hiding nonce':
    'The first of each signer’s two per-signature nonces (d_i); its public commitment D_i hides the secret value while still binding the signer to it.',
  'partial signature':
    'One signer’s contribution (z_i) computed from only their own share. On their own they sign nothing; summed, k of them form one valid signature.',
};

// Wrap a term in an accessible tooltip. Returns an inline <span> you can drop
// into any text node. Uses the native title attribute AND a visible custom
// bubble so it works on hover, focus, and touch without extra JS state.
export function withGlossary(term: string, label?: string): HTMLElement {
  const def = GLOSSARY[term];
  const span = document.createElement('span');
  span.className = 'glossary-term';
  span.textContent = label ?? term;
  span.setAttribute('tabindex', '0');
  span.setAttribute('role', 'button');
  span.setAttribute('aria-label', `${label ?? term}: ${def ?? ''}`);
  if (def) {
    span.title = def;
    const bubble = document.createElement('span');
    bubble.className = 'glossary-bubble';
    bubble.setAttribute('role', 'tooltip');
    bubble.textContent = def;
    span.appendChild(bubble);
  }
  return span;
}

// Convenience: append a glossary term into a parent, with surrounding text.
export function appendWithGlossary(
  parent: HTMLElement,
  before: string,
  term: string,
  after: string,
  label?: string,
): void {
  if (before) parent.appendChild(document.createTextNode(before));
  parent.appendChild(withGlossary(term, label));
  if (after) parent.appendChild(document.createTextNode(after));
}
