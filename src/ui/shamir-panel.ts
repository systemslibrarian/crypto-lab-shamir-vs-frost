// Shamir SSS interactive panel — split → reconstruct → sign.
// The key-in-memory badge flips to ⚠ the moment the secret is reconstructed.

import { split, reconstruct } from '../shamir/shamir.js';
import type { Share } from '../shamir/types.js';
import { createKeyBadge, type KeyState, type PanelHandle } from './key-indicator.js';
import { renderPolyViz } from './poly-viz.js';
import { renderInterpViz, teachingY } from './interp-viz.js';
import { withGlossary } from './glossary.js';

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
  // The secret that was actually split, kept so the panel can grade every
  // reconstruction attempt instead of echoing back whatever came out.
  let originalSecret: Uint8Array | null = null;
  // Threshold the current shares were actually split with. Reconstruction must
  // match this — not whatever the k input reads now — since the user can edit
  // the input after splitting (and validateNK clamps k to n at split time).
  let activeK = 0;

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
  kLabel.appendChild(document.createTextNode(''));
  kLabel.appendChild(withGlossary('threshold', 'Threshold (k)'));
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
  step2Hint.textContent = 'Click shares above to select. Fewer than k? Reconstruct anyway — interpolation still returns bytes, and this panel checks them against the real secret.';

  // Live interpolation intuition: fans of curves with < k points, one locked
  // curve at k. Teaches "why exactly k?" as something you watch happen.
  const interpWrap = document.createElement('div');
  interpWrap.className = 'interp-wrap';
  interpWrap.style.display = 'none';
  const interpHeading = document.createElement('p');
  interpHeading.className = 'text-xs text-muted mb-sm';
  interpHeading.textContent = 'Why exactly k? — an illustration over the real numbers (the theorem holds over any field, including the GF(256) used above; the coordinates here are chosen for legibility, not the actual share bytes):';
  const interpCaption = document.createElement('p');
  interpCaption.className = 'text-xs mb-sm';
  const interpSvgHost = document.createElement('div');
  interpWrap.appendChild(interpHeading);
  interpWrap.appendChild(interpCaption);
  interpWrap.appendChild(interpSvgHost);

  const reconstructBtn = document.createElement('button');
  reconstructBtn.className = 'btn btn-primary';
  reconstructBtn.textContent = 'Reconstruct';
  reconstructBtn.disabled = true;

  const reconstructResult = document.createElement('div');
  reconstructResult.setAttribute('role', 'status');
  reconstructResult.setAttribute('aria-live', 'polite');

  step2.appendChild(step2Label);
  step2.appendChild(step2Title);
  step2.appendChild(step2Hint);
  step2.appendChild(interpWrap);
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
  step3Title.textContent = 'Use the recovered secret (HMAC-SHA256)';

  const step3Note = document.createElement('p');
  step3Note.className = 'text-muted text-xs mb-sm';
  step3Note.textContent = 'Shamir recovers raw bytes, not a signing key — so here we use them as a symmetric HMAC key. This is a different operation from FROST’s Ed25519 signature; what they share is the memory question, not the primitive.';

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
  signResultS.setAttribute('role', 'status');
  signResultS.setAttribute('aria-live', 'polite');

  step3.appendChild(step3Label);
  step3.appendChild(step3Title);
  step3.appendChild(step3Note);
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

  // Reconstruction below k is deliberately allowed. Disabling the button would
  // hide what Lagrange interpolation actually returns with too few points — the
  // whole reason k is the threshold.
  function updateReconstructBtn() {
    const count = selectedIndices.size;
    reconstructBtn.disabled = count < 2;
    reconstructBtn.textContent = count >= 2 && count < activeK
      ? `Reconstruct anyway (${count} of k=${activeK})`
      : 'Reconstruct';
    reconstructBtn.title = count < 2
      ? 'Select at least 2 shares — interpolation needs two points to draw a line'
      : count < activeK
        ? 'Below the threshold — reconstruct anyway and compare what comes back with the real secret'
        : '';
  }

  // Live interpolation intuition, driven by the current selection. Shows the
  // fan of candidate curves (secret undetermined) until exactly k are chosen,
  // then the single solved curve locks the secret at x=0.
  function renderInterp(reconstructed: boolean) {
    if (activeK < 2) { interpWrap.style.display = 'none'; return; }
    interpWrap.style.display = 'block';
    // Cap the visible points at k so the "one curve at k" story reads cleanly,
    // preferring the shares the learner actually selected.
    const chosen = [...selectedIndices].slice(0, activeK);
    const pts = chosen.map(x => ({ x, y: teachingY(x, activeK) }));
    const locked = reconstructed || selectedIndices.size >= activeK;
    const showPts = locked ? pts : pts.slice(0, activeK - 1);
    interpSvgHost.innerHTML = '';
    interpSvgHost.appendChild(renderInterpViz(showPts, locked, activeK));
    if (locked) {
      interpCaption.style.color = 'var(--key-safe)';
      interpCaption.textContent = `k=${activeK} points selected → exactly one degree-${activeK - 1} curve fits, so the secret at x=0 is now pinned down.`;
    } else {
      interpCaption.style.color = 'var(--accent-text)';
      const need = activeK - selectedIndices.size;
      interpCaption.textContent = `With ${selectedIndices.size} of k=${activeK} points, infinitely many degree-${activeK - 1} curves still fit — the secret could be anything. Select ${need} more.`;
    }
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
    originalSecret = secretBytes;
    activeK = k; // shares now require exactly k of n to reconstruct

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
        if (!reconstructedSecret) renderInterp(false);
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
    label.textContent = 'Actual share bytes over GF(256) (first byte of each share). These are the real values you distribute — the smooth-curve view below explains why any k of them are enough.';
    vizContainer.appendChild(label);
    vizContainer.appendChild(renderPolyViz(
      shares.map(s => ({ x: s.x, y: s.y[0] })),
      null,
    ));

    // Enable step 2
    step2.style.opacity = '1';
    step2.style.pointerEvents = '';
    updateReconstructBtn();
    renderInterp(false);
  });

  // ── Reconstruct handler ──────────────────────────────────────────────────
  reconstructBtn.addEventListener('click', () => {
    const selected = shares.filter(s => selectedIndices.has(s.x));
    if (selected.length < 2) return;

    let candidate: Uint8Array;
    try {
      candidate = reconstruct(selected);
    } catch (e) {
      reconstructResult.innerHTML = '';
      reconstructResult.appendChild(callout('warn', '✗', String(e)));
      return;
    }

    // Grade the result against the secret that was actually split. With fewer
    // than k shares interpolation still returns bytes — they are simply the
    // wrong ones, and nothing in them says so.
    const matches = originalSecret !== null
      && candidate.length === originalSecret.length
      && candidate.every((b, i) => b === originalSecret![i]);

    if (selected.length < activeK) {
      // Nothing was recovered, so the key never entered memory: the badge stays put.
      renderInterp(false);
      reconstructResult.innerHTML = '';
      reconstructResult.appendChild(callout('safe', '🛡️',
        `Interpolation ran on ${selected.length} of k=${activeK} points and returned ${candidate.length} bytes — ` +
        `it always returns something. Compared against the real secret byte-for-byte: ` +
        `<strong>${matches ? 'MATCH (should not happen below k)' : 'no match'}</strong>. ` +
        `Every one of the 256^${candidate.length} possible secrets is equally consistent with the shares you hold, ` +
        `so the bytes below carry no information about the real one — and nothing in them tells you that.`));

      const wrongRow = document.createElement('div');
      wrongRow.className = 'col mt-sm';
      wrongRow.appendChild(Object.assign(document.createElement('span'), {
        className: 'text-muted text-xs',
        textContent: `What ${selected.length} shares actually interpolate to (hex):`,
      }));
      wrongRow.appendChild(monoBox(hexOf(candidate)));
      wrongRow.appendChild(Object.assign(document.createElement('p'), {
        className: 'text-xs text-muted mt-sm',
        textContent: `Decoded as text: "${td.decode(candidate)}"  ·  Select ${activeK - selected.length} more share${activeK - selected.length === 1 ? '' : 's'} and reconstruct again.`,
      }));
      reconstructResult.appendChild(wrongRow);
      return;
    }

    reconstructedSecret = candidate;

    // 🔴 KEY IS NOW IN MEMORY
    setBadge('warn');

    // Snap the interpolation curve into place, revealing the secret at x=0.
    renderInterp(true);

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
      `The full secret now exists in memory. Any code running at this moment has access to it. ` +
      `Checked against the secret that was split: <strong>${matches ? 'byte-for-byte match' : 'MISMATCH — reconstruction is broken'}</strong>.`));

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
  async function doSign() {
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
      note.textContent = 'Different primitive on purpose: Shamir just recovers raw secret bytes, so here we use them as an HMAC-SHA256 key (a symmetric MAC). FROST instead co-produces a real Ed25519 signature and never recovers a key. Both panels answer "did the key touch memory?" — they are NOT doing the same signing operation.';
      row.appendChild(note);

      signResultS.appendChild(row);
    } catch (e) {
      signResultS.innerHTML = '';
      signResultS.appendChild(callout('warn', '✗', `Signing failed: ${e}`));
    }
  }
  signBtnS.addEventListener('click', () => { void doSign(); });

  // ── Panel control API (used by the page for Run-both / Reset / Compromise) ──
  function reset() {
    shares = [];
    activeK = 0;
    selectedIndices.clear();
    reconstructedSecret = null;
    originalSecret = null;
    shareGrid.innerHTML = '';
    shareGrid.style.display = 'none';
    vizContainer.innerHTML = '';
    vizContainer.style.display = 'none';
    interpWrap.style.display = 'none';
    interpSvgHost.innerHTML = '';
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
    // activeK is now set by the split handler to the threshold actually used.
    const cards = Array.from(shareGrid.children) as HTMLElement[];
    for (let i = 0; i < activeK && i < cards.length; i++) cards[i].click();
    reconstructBtn.click();
    await doSign(); // await the async HMAC so the run truly completes
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
