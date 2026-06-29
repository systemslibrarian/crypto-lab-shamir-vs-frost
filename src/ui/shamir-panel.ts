// Shamir SSS interactive panel — split → reconstruct → sign.
// The key-in-memory badge flips to ⚠ the moment the secret is reconstructed.

import { split, reconstruct } from '../shamir/shamir.js';
import type { Share } from '../shamir/types.js';
import { createKeyBadge, type KeyState, type PanelHandle } from './key-indicator.js';
import { renderPolyViz } from './poly-viz.js';

const te = new TextEncoder();
const td = new TextDecoder();

function hexOf(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function monoBox(text: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'mono-box';
  const span = document.createElement('span');
  span.textContent = text;
  wrap.appendChild(span);
  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.textContent = 'copy';
  copyBtn.onclick = async () => {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    copyBtn.textContent = 'copied!';
    setTimeout(() => { copyBtn.textContent = 'copy'; }, 1500);
  };
  wrap.appendChild(copyBtn);
  return wrap;
}

function callout(type: 'warn' | 'safe' | 'info' | 'danger', icon: string, text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `callout callout-${type} fade-in`;
  el.innerHTML = `<span class="callout-icon">${icon}</span><span>${text}</span>`;
  return el;
}

export function renderShamirPanel(): PanelHandle {
  // ── State ─────────────────────────────────────────────────────────────────
  let shares: Share[] = [];
  let selectedIndices = new Set<number>();
  let reconstructedSecret: Uint8Array | null = null;

  const badge = createKeyBadge('neutral');
  const stateListeners: Array<(s: KeyState) => void> = [];
  // Single chokepoint for badge changes so the verdict strip stays in sync.
  function setBadge(s: KeyState) {
    badge.setState(s);
    stateListeners.forEach(f => f(s));
  }

  // ── Root card ────────────────────────────────────────────────────────────
  const card = document.createElement('div');
  card.className = 'card panel-shamir';

  const header = document.createElement('div');
  header.className = 'panel-header';
  const panelName = document.createElement('span');
  panelName.className = 'panel-name';
  panelName.textContent = '⚠ Shamir SSS';
  header.appendChild(panelName);
  header.appendChild(badge.el);
  card.appendChild(header);

  // ── Step 1: Split ────────────────────────────────────────────────────────
  const step1 = document.createElement('div');
  step1.className = 'step';

  const step1Label = document.createElement('div');
  step1Label.className = 'step-label';
  step1Label.textContent = 'Step 1';

  const step1Title = document.createElement('div');
  step1Title.className = 'step-title';
  step1Title.textContent = 'Split the secret';

  // Secret input
  const secretField = document.createElement('div');
  secretField.className = 'field';
  const secretLabel = document.createElement('label');
  secretLabel.htmlFor = 'shamir-secret';
  secretLabel.textContent = 'Secret (up to 32 chars)';
  const secretInput = document.createElement('input');
  secretInput.type = 'text';
  secretInput.id = 'shamir-secret';
  secretInput.maxLength = 32;
  secretInput.value = 'correct horse battery';
  secretField.appendChild(secretLabel);
  secretField.appendChild(secretInput);

  // n and k controls
  const nkRow = document.createElement('div');
  nkRow.className = 'inline-fields';

  const nField = document.createElement('div');
  nField.className = 'field';
  const nLabel = document.createElement('label');
  nLabel.htmlFor = 'shamir-n';
  nLabel.textContent = 'Shares (n)';
  const nInput = document.createElement('input');
  nInput.type = 'number';
  nInput.id = 'shamir-n';
  nInput.min = '2';
  nInput.max = '10';
  nInput.value = '5';
  nInput.className = 'num-input';
  nField.appendChild(nLabel);
  nField.appendChild(nInput);

  const kField = document.createElement('div');
  kField.className = 'field';
  const kLabel = document.createElement('label');
  kLabel.htmlFor = 'shamir-k';
  kLabel.textContent = 'Threshold (k)';
  const kInput = document.createElement('input');
  kInput.type = 'number';
  kInput.id = 'shamir-k';
  kInput.min = '2';
  kInput.max = '10';
  kInput.value = '3';
  kInput.className = 'num-input';
  kField.appendChild(kLabel);
  kField.appendChild(kInput);

  nkRow.appendChild(nField);
  nkRow.appendChild(kField);

  const kWarnEl = document.createElement('div');
  kWarnEl.className = 'text-muted text-xs';
  kWarnEl.style.display = 'none';

  const splitBtn = document.createElement('button');
  splitBtn.className = 'btn btn-primary';
  splitBtn.textContent = 'Split Secret';

  // Share grid and viz
  const shareGrid = document.createElement('div');
  shareGrid.className = 'share-grid';
  shareGrid.style.display = 'none';

  const vizContainer = document.createElement('div');
  vizContainer.style.display = 'none';

  step1.appendChild(step1Label);
  step1.appendChild(step1Title);
  step1.appendChild(secretField);
  step1.appendChild(nkRow);
  step1.appendChild(kWarnEl);
  step1.appendChild(document.createElement('div')); // spacer
  step1.appendChild(splitBtn);
  step1.appendChild(shareGrid);
  step1.appendChild(vizContainer);
  card.appendChild(step1);

  // ── Step 2: Reconstruct ──────────────────────────────────────────────────
  const step2 = document.createElement('div');
  step2.className = 'step';
  step2.style.opacity = '0.4';
  step2.style.pointerEvents = 'none';

  const step2Label = document.createElement('div');
  step2Label.className = 'step-label';
  step2Label.textContent = 'Step 2';

  const step2Title = document.createElement('div');
  step2Title.className = 'step-title';
  step2Title.textContent = 'Reconstruct the secret';

  const step2Hint = document.createElement('p');
  step2Hint.className = 'text-muted text-xs mb-sm';
  step2Hint.textContent = 'Click shares above to select. Reconstruct requires ≥ k shares.';

  const reconstructBtn = document.createElement('button');
  reconstructBtn.className = 'btn btn-primary';
  reconstructBtn.textContent = 'Reconstruct';
  reconstructBtn.disabled = true;

  const reconstructResult = document.createElement('div');

  step2.appendChild(step2Label);
  step2.appendChild(step2Title);
  step2.appendChild(step2Hint);
  step2.appendChild(reconstructBtn);
  step2.appendChild(reconstructResult);
  card.appendChild(step2);

  // ── Step 3: Sign ─────────────────────────────────────────────────────────
  const step3 = document.createElement('div');
  step3.className = 'step';
  step3.style.opacity = '0.4';
  step3.style.pointerEvents = 'none';

  const step3Label = document.createElement('div');
  step3Label.className = 'step-label';
  step3Label.textContent = 'Step 3';

  const step3Title = document.createElement('div');
  step3Title.className = 'step-title';
  step3Title.textContent = 'Sign a message';

  const msgFieldS = document.createElement('div');
  msgFieldS.className = 'field';
  const msgLabelS = document.createElement('label');
  msgLabelS.htmlFor = 'shamir-msg';
  msgLabelS.textContent = 'Message';
  const msgInputS = document.createElement('input');
  msgInputS.type = 'text';
  msgInputS.id = 'shamir-msg';
  msgInputS.value = 'Transfer $1000 to Alice';
  msgFieldS.appendChild(msgLabelS);
  msgFieldS.appendChild(msgInputS);

  const signBtnS = document.createElement('button');
  signBtnS.className = 'btn btn-primary';
  signBtnS.textContent = 'Sign (HMAC-SHA256)';

  const signResultS = document.createElement('div');

  step3.appendChild(step3Label);
  step3.appendChild(step3Title);
  step3.appendChild(msgFieldS);
  step3.appendChild(signBtnS);
  step3.appendChild(signResultS);
  card.appendChild(step3);

  // ── Attacker overlay (driven from the page-level "Compromise" control) ─────
  const attackResult = document.createElement('div');
  attackResult.style.display = 'none';
  attackResult.style.marginTop = '1rem';
  attackResult.setAttribute('role', 'status');
  attackResult.setAttribute('aria-live', 'polite');
  card.appendChild(attackResult);

  // ── Validation helpers ───────────────────────────────────────────────────
  function validateNK(): { n: number; k: number; valid: boolean } {
    const n = Math.min(10, Math.max(2, parseInt(nInput.value) || 5));
    const k = Math.min(n, Math.max(2, parseInt(kInput.value) || 3));
    kWarnEl.style.display = k === 1 ? 'block' : 'none';
    kWarnEl.textContent = '⚠ k=1 means any single share reconstructs the secret.';
    return { n, k, valid: k <= n && n >= 2 };
  }

  function updateReconstructBtn() {
    const k = Math.min(10, Math.max(2, parseInt(kInput.value) || 3));
    reconstructBtn.disabled = selectedIndices.size < k;
    reconstructBtn.title = selectedIndices.size < k
      ? `Select at least ${k} shares to reconstruct`
      : '';
  }

  // ── Split handler ────────────────────────────────────────────────────────
  splitBtn.addEventListener('click', () => {
    const { n, k, valid } = validateNK();
    if (!valid) return;

    const secretText = secretInput.value.trim();
    if (!secretText) { alert('Secret cannot be empty'); return; }
    if (secretText.length > 32) { alert('Secret capped at 32 characters'); return; }

    const secretBytes = te.encode(secretText);

    try {
      shares = split(secretBytes, n, k);
    } catch (e) {
      alert(String(e));
      return;
    }

    // Reset downstream state
    selectedIndices.clear();
    reconstructedSecret = null;
    reconstructResult.innerHTML = '';
    signResultS.innerHTML = '';
    attackResult.innerHTML = '';
    attackResult.style.display = 'none';
    setBadge('neutral');

    // Render share cards
    shareGrid.innerHTML = '';
    shareGrid.style.display = 'grid';
    for (const share of shares) {
      const sc = document.createElement('div');
      sc.className = 'share-card';
      sc.setAttribute('tabindex', '0');
      sc.setAttribute('role', 'checkbox');
      sc.setAttribute('aria-checked', 'false');
      sc.setAttribute('aria-label', `Share ${share.x}`);
      sc.title = `Share index x=${share.x}, y[0]=0x${share.y[0].toString(16).padStart(2,'0')}`;

      const lbl = document.createElement('div');
      lbl.className = 'share-card-label';
      lbl.textContent = `Share ${share.x}`;

      const xEl = document.createElement('div');
      xEl.className = 'share-card-x';
      xEl.textContent = `x = ${share.x}`;

      const yEl = document.createElement('div');
      yEl.className = 'share-card-y';
      yEl.textContent = hexOf(share.y.slice(0, 4)) + '…';

      sc.appendChild(lbl);
      sc.appendChild(xEl);
      sc.appendChild(yEl);

      const toggle = () => {
        if (selectedIndices.has(share.x)) {
          selectedIndices.delete(share.x);
          sc.classList.remove('selected');
          sc.setAttribute('aria-checked', 'false');
        } else {
          selectedIndices.add(share.x);
          sc.classList.add('selected');
          sc.setAttribute('aria-checked', 'true');
        }
        updateReconstructBtn();
      };

      sc.addEventListener('click', toggle);
      sc.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });

      shareGrid.appendChild(sc);
    }

    // Poly viz
    vizContainer.innerHTML = '';
    vizContainer.style.display = 'block';
    const label = document.createElement('p');
    label.className = 'text-xs text-muted mb-sm';
    label.textContent = 'Share values (first byte shown). Any k points uniquely determine the secret at x=0.';
    vizContainer.appendChild(label);
    vizContainer.appendChild(renderPolyViz(
      shares.map(s => ({ x: s.x, y: s.y[0] })),
      null,
    ));

    // Enable step 2
    step2.style.opacity = '1';
    step2.style.pointerEvents = '';
    updateReconstructBtn();
  });

  // ── Reconstruct handler ──────────────────────────────────────────────────
  reconstructBtn.addEventListener('click', () => {
    const k = Math.min(10, Math.max(2, parseInt(kInput.value) || 3));
    const selected = shares.filter(s => selectedIndices.has(s.x));
    if (selected.length < k) return;

    try {
      reconstructedSecret = reconstruct(selected);
    } catch (e) {
      reconstructResult.innerHTML = '';
      reconstructResult.appendChild(callout('warn', '✗', String(e)));
      return;
    }

    // 🔴 KEY IS NOW IN MEMORY
    setBadge('warn');

    reconstructResult.innerHTML = '';

    // Update viz with secret revealed
    vizContainer.innerHTML = '';
    vizContainer.style.display = 'block';
    const label = document.createElement('p');
    label.className = 'text-xs text-muted mb-sm';
    label.textContent = 'Secret revealed at x=0 (highlighted). Key is now in memory.';
    vizContainer.appendChild(label);
    vizContainer.appendChild(renderPolyViz(
      shares.map(s => ({ x: s.x, y: s.y[0], selected: selectedIndices.has(s.x) })),
      reconstructedSecret[0],
    ));

    reconstructResult.appendChild(callout('warn', '⚠',
      'The full secret now exists in memory. Any code running at this moment has access to it.'));

    const secretStr = td.decode(reconstructedSecret);
    const row = document.createElement('div');
    row.className = 'row mt';
    const secretLabel2 = document.createElement('span');
    secretLabel2.className = 'text-muted text-xs';
    secretLabel2.textContent = 'Recovered secret:';
    row.appendChild(secretLabel2);
    row.appendChild(monoBox(secretStr));
    reconstructResult.appendChild(row);

    // Enable step 3
    step3.style.opacity = '1';
    step3.style.pointerEvents = '';
  });

  // ── Sign handler ─────────────────────────────────────────────────────────
  signBtnS.addEventListener('click', async () => {
    if (!reconstructedSecret) return;

    const msg = msgInputS.value;
    if (!msg) { alert('Message cannot be empty'); return; }
    const msgBytes = te.encode(msg);

    try {
      // Copy into a plain ArrayBuffer to satisfy SubtleCrypto's type requirements
      const keyMaterial: Uint8Array<ArrayBuffer> = new Uint8Array(reconstructedSecret);
      const key = await crypto.subtle.importKey(
        'raw', keyMaterial,
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign'],
      );
      const sigBuf = await crypto.subtle.sign('HMAC', key, msgBytes);
      const sigHex = hexOf(new Uint8Array(sigBuf));

      signResultS.innerHTML = '';
      signResultS.appendChild(callout('warn', '⚠',
        'Signed using the reconstructed secret. The private key remained in memory throughout.'));

      const row = document.createElement('div');
      row.className = 'col mt-sm';

      const sigLabel = document.createElement('span');
      sigLabel.className = 'text-muted text-xs';
      sigLabel.textContent = 'HMAC-SHA256 signature (hex):';
      row.appendChild(sigLabel);
      row.appendChild(monoBox(sigHex));

      const note = document.createElement('p');
      note.className = 'text-xs text-muted mt-sm';
      note.textContent = 'Note: Shamir SSS protects a symmetric secret. Compare with FROST which signs without ever assembling the private key.';
      row.appendChild(note);

      signResultS.appendChild(row);
    } catch (e) {
      signResultS.innerHTML = '';
      signResultS.appendChild(callout('warn', '✗', `Signing failed: ${e}`));
    }
  });

  // ── Panel control API (used by the page for Run-both / Reset / Compromise) ──
  function reset() {
    shares = [];
    selectedIndices.clear();
    reconstructedSecret = null;
    shareGrid.innerHTML = '';
    shareGrid.style.display = 'none';
    vizContainer.innerHTML = '';
    vizContainer.style.display = 'none';
    reconstructResult.innerHTML = '';
    signResultS.innerHTML = '';
    attackResult.innerHTML = '';
    attackResult.style.display = 'none';
    kWarnEl.style.display = 'none';
    reconstructBtn.disabled = true;
    step2.style.opacity = '0.4';
    step2.style.pointerEvents = 'none';
    step3.style.opacity = '0.4';
    step3.style.pointerEvents = 'none';
    setBadge('neutral');
  }

  async function runAll() {
    reset();
    splitBtn.click();
    const k = Math.min(10, Math.max(2, parseInt(kInput.value) || 3));
    const cards = Array.from(shareGrid.children) as HTMLElement[];
    for (let i = 0; i < k && i < cards.length; i++) cards[i].click();
    reconstructBtn.click();
    await new Promise(r => setTimeout(r, 150));
    signBtnS.click();
  }

  function attack() {
    attackResult.style.display = 'block';
    attackResult.innerHTML = '';
    if (reconstructedSecret) {
      attackResult.appendChild(callout('danger', '😈',
        `Attacker compromised this machine while the key sat in memory and exfiltrated the FULL secret: ` +
        `"${td.decode(reconstructedSecret)}". They can now forge any signature, forever. Game over.`));
    } else {
      attackResult.appendChild(callout('info', '😈',
        'Attacker compromised this machine, but the secret has not been reconstructed yet. ' +
        'Run the protocol to the reconstruction step to see exactly what leaks at that moment.'));
    }
  }

  return {
    el: card,
    runAll,
    reset,
    attack,
    onStateChange: cb => { stateListeners.push(cb); cb('neutral'); },
  };
}
