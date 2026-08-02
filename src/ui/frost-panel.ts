// FROST interactive panel — distribute → commit → sign.
// The key badge stays green throughout: the private key is NEVER reconstructed.

import { dealerKeyGen } from '../frost/keygen.js';
import { generateCommitment } from '../frost/round1.js';
import { signWithSubset, soloForgeAttempt } from '../frost/attack.js';
import type { DealerResult, Nonces, Commitment, PartialSig } from '../frost/types.js';
import { fieldAdd, scalarToBytes } from '../frost/field.js';
import { createKeyBadge, type KeyState, type PanelHandle } from './key-indicator.js';
import { withGlossary } from './glossary.js';

const te = new TextEncoder();

function hexOf(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function monoBox(text: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'mono-box';
  wrap.appendChild(Object.assign(document.createElement('span'), { textContent: text }));
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

function inlineErr(msg: string): HTMLElement {
  return callout('warn', '✗', msg);
}

function lockStep(step: HTMLElement) {
  step.style.opacity = '0.4';
  step.style.pointerEvents = 'none';
  step.setAttribute('aria-disabled', 'true');
}

function unlockStep(step: HTMLElement) {
  step.style.opacity = '1';
  step.style.pointerEvents = '';
  step.removeAttribute('aria-disabled');
}

export function renderFrostPanel(): PanelHandle {
  // ── State ─────────────────────────────────────────────────────────────────
  let dealer: DealerResult | null = null;
  let noncesMap = new Map<number, Nonces>();
  let commitmentsMap = new Map<number, Commitment>();
  let selectedSigners = new Set<number>();
  const participantCardEls = new Map<number, HTMLElement>();

  const badge = createKeyBadge('safe');
  // FROST never reconstructs the key, so the state stays 'safe' throughout —
  // but we still notify listeners so the verdict strip mirrors it on reset.
  const stateListeners: Array<(s: KeyState) => void> = [];
  function notify(s: KeyState) { stateListeners.forEach(f => f(s)); }

  // ── Root card ────────────────────────────────────────────────────────────
  const card = document.createElement('div');
  card.className = 'card panel-frost';

  const header = document.createElement('div');
  header.className = 'panel-header';
  header.appendChild(Object.assign(document.createElement('span'), {
    className: 'panel-name', textContent: '✓ FROST',
  }));
  header.appendChild(badge.el);
  card.appendChild(header);

  // ── Step 1: Distribute ───────────────────────────────────────────────────
  const step1 = document.createElement('div');
  step1.className = 'step';
  step1.appendChild(Object.assign(document.createElement('div'), { className: 'step-label', textContent: 'Step 1' }));
  step1.appendChild(Object.assign(document.createElement('div'), { className: 'step-title', textContent: 'Distribute key shares' }));

  const nkRow = document.createElement('div');
  nkRow.className = 'inline-fields';

  function numField(id: string, label: string, val: string): { field: HTMLElement; input: HTMLInputElement } {
    const field = document.createElement('div');
    field.className = 'field';
    const lbl = document.createElement('label');
    lbl.htmlFor = id;
    lbl.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.id = id;
    input.min = '2';
    input.max = '10';
    input.value = val;
    input.className = 'num-input';
    field.appendChild(lbl);
    field.appendChild(input);
    return { field, input };
  }

  const { field: nField, input: nInput } = numField('frost-n', 'Participants (n)', '5');
  const { field: kField, input: kInput } = numField('frost-k', 'Threshold (k)', '3');
  nkRow.appendChild(nField);
  nkRow.appendChild(kField);
  step1.appendChild(nkRow);

  const distributeBtn = document.createElement('button');
  distributeBtn.className = 'btn btn-primary';
  distributeBtn.textContent = 'Distribute Key';
  step1.appendChild(distributeBtn);

  const distributeErr = document.createElement('div');
  distributeErr.style.display = 'none';
  step1.appendChild(distributeErr);

  const dealerNote = document.createElement('p');
  dealerNote.className = 'text-xs text-muted mt-sm';
  dealerNote.appendChild(document.createTextNode('Simplified: a trusted dealer generates key shares. Production FROST uses '));
  dealerNote.appendChild(withGlossary('DKG', 'Distributed Key Generation (DKG)'));
  dealerNote.appendChild(document.createTextNode(' to remove this trust assumption.'));
  step1.appendChild(dealerNote);

  const participantGrid = document.createElement('div');
  participantGrid.className = 'participant-grid';
  participantGrid.style.display = 'none';
  step1.appendChild(participantGrid);

  const distributeResult = document.createElement('div');
  step1.appendChild(distributeResult);

  card.appendChild(step1);

  // ── Step 2: Round 1 commitments ──────────────────────────────────────────
  const step2 = document.createElement('div');
  step2.className = 'step';
  lockStep(step2);

  step2.appendChild(Object.assign(document.createElement('div'), { className: 'step-label', textContent: 'Step 2 — Round 1' }));
  step2.appendChild(Object.assign(document.createElement('div'), { className: 'step-title', textContent: 'Generate commitments' }));
  const step2Desc = document.createElement('p');
  step2Desc.className = 'text-muted text-xs mb-sm';
  step2Desc.appendChild(document.createTextNode('Each participant generates a random '));
  step2Desc.appendChild(withGlossary('nonce'));
  step2Desc.appendChild(document.createTextNode(' pair and broadcasts the '));
  step2Desc.appendChild(withGlossary('commitment', 'commitments'));
  step2Desc.appendChild(document.createTextNode(' (public values only). '));
  const nonceWarn = withGlossary('nonce', 'Reusing a nonce is catastrophic');
  step2Desc.appendChild(nonceWarn);
  step2Desc.appendChild(document.createTextNode(' — it leaks the share, so a fresh pair is drawn every round.'));
  step2.appendChild(step2Desc);

  const commitBtn = document.createElement('button');
  commitBtn.className = 'btn btn-primary';
  commitBtn.textContent = 'Generate Commitments';
  step2.appendChild(commitBtn);

  const commitResult = document.createElement('div');
  step2.appendChild(commitResult);

  card.appendChild(step2);

  // ── Step 3: Round 2 signing ──────────────────────────────────────────────
  const step3 = document.createElement('div');
  step3.className = 'step';
  lockStep(step3);

  step3.appendChild(Object.assign(document.createElement('div'), { className: 'step-label', textContent: 'Step 3 — Round 2' }));
  step3.appendChild(Object.assign(document.createElement('div'), { className: 'step-title', textContent: 'Collaborative signing' }));
  const step3Desc = document.createElement('p');
  step3Desc.className = 'text-muted text-xs mb-sm';
  step3Desc.appendChild(document.createTextNode('Select at least k participants. Each produces a '));
  step3Desc.appendChild(withGlossary('partial signature'));
  step3Desc.appendChild(document.createTextNode(' using only their own share — the '));
  step3Desc.appendChild(withGlossary('Lagrange coefficient'));
  step3Desc.appendChild(document.createTextNode(' and '));
  step3Desc.appendChild(withGlossary('binding factor'));
  step3Desc.appendChild(document.createTextNode(' make the parts combine into exactly one Ed25519 signature.'));
  step3.appendChild(step3Desc);

  const signerGrid = document.createElement('div');
  signerGrid.className = 'participant-grid';
  step3.appendChild(signerGrid);

  const msgField = document.createElement('div');
  msgField.className = 'field';
  const msgLabel = document.createElement('label');
  msgLabel.htmlFor = 'frost-msg';
  msgLabel.textContent = 'Message to sign';
  const msgInput = document.createElement('input');
  msgInput.type = 'text';
  msgInput.id = 'frost-msg';
  msgInput.value = 'Transfer $1000 to Alice';
  msgField.appendChild(msgLabel);
  msgField.appendChild(msgInput);
  step3.appendChild(msgField);

  const signBtn = document.createElement('button');
  signBtn.className = 'btn btn-primary';
  signBtn.textContent = 'Sign';
  signBtn.disabled = true;
  step3.appendChild(signBtn);

  const signErr = document.createElement('div');
  signErr.style.display = 'none';
  step3.appendChild(signErr);

  // Aggregation visualization: partial-signature chips flowing into one sum.
  const aggViz = document.createElement('div');
  aggViz.className = 'agg-viz';
  aggViz.style.display = 'none';
  step3.appendChild(aggViz);

  const signResult = document.createElement('div');
  signResult.setAttribute('role', 'status');
  signResult.setAttribute('aria-live', 'polite');
  step3.appendChild(signResult);

  card.appendChild(step3);

  // ── Attacker overlay (driven from the page-level "Compromise" control) ─────
  const attackResult = document.createElement('div');
  attackResult.style.display = 'none';
  attackResult.style.marginTop = '1rem';
  attackResult.setAttribute('role', 'status');
  attackResult.setAttribute('aria-live', 'polite');
  card.appendChild(attackResult);

  // Short hex of a scalar (first/last bytes) for a compact chip label.
  function shortScalar(s: bigint): string {
    const b = scalarToBytes(s);
    const hx = hexOf(b);
    return `${hx.slice(0, 6)}…${hx.slice(-4)}`;
  }

  // Render the k partial signatures (z_i) as chips, then show the running sum
  // accumulating one at a time into the aggregate z. This is the whole thesis
  // made visible: each z_i comes from ONE share, and only their SUM is a
  // signature — no share ever met another, no key was ever assembled.
  function renderAggregation(partials: PartialSig[]) {
    aggViz.style.display = 'block';
    aggViz.innerHTML = '';

    const title = document.createElement('p');
    title.className = 'text-xs mb-sm agg-title';
    title.textContent = 'Watch the aggregate build: each participant emits one partial signature z_i from only their own share, and the parts add up.';
    aggViz.appendChild(title);

    const chipRow = document.createElement('div');
    chipRow.className = 'agg-chips';
    chipRow.setAttribute('role', 'list');
    chipRow.setAttribute('aria-label', 'Partial signatures being aggregated');
    aggViz.appendChild(chipRow);

    const sumLine = document.createElement('div');
    sumLine.className = 'agg-sum';
    const sumLabel = document.createElement('span');
    sumLabel.className = 'agg-sum-label';
    sumLabel.textContent = 'running sum z =';
    const sumVal = document.createElement('span');
    sumVal.className = 'agg-sum-val font-mono';
    sumVal.setAttribute('role', 'status');
    sumVal.setAttribute('aria-live', 'polite');
    sumVal.textContent = '0';
    sumLine.appendChild(sumLabel);
    sumLine.appendChild(sumVal);
    aggViz.appendChild(sumLine);

    const caption = document.createElement('p');
    caption.className = 'text-xs mt-sm agg-caption';
    caption.textContent = `${partials.length} partial signatures add up — no share ever met another, and the private key was never assembled on any machine.`;
    aggViz.appendChild(caption);

    let running = 0n;
    partials.forEach((ps, i) => {
      const chip = document.createElement('span');
      chip.className = 'agg-chip';
      chip.setAttribute('role', 'listitem');
      chip.style.animationDelay = `${i * 0.18}s`;
      chip.innerHTML =
        `<span class="agg-chip-who">P${ps.participantIndex}</span>` +
        `<span class="agg-chip-z font-mono">z_${ps.participantIndex} = ${shortScalar(ps.z)}</span>`;
      chip.setAttribute('aria-label', `Partial signature from participant ${ps.participantIndex}`);
      chipRow.appendChild(chip);

      // Accumulate the running sum with the same field arithmetic used by the
      // real aggregate() — this is the actual sum, not a mock.
      running = fieldAdd(running, ps.z);
      const snapshot = running;
      setTimeout(() => {
        sumVal.textContent = shortScalar(snapshot);
        sumVal.classList.add('agg-sum-tick');
        setTimeout(() => sumVal.classList.remove('agg-sum-tick'), 200);
      }, (i + 1) * 180);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getK(): number { return Math.min(10, Math.max(2, parseInt(kInput.value) || 3)); }
  function getN(): number { return Math.min(10, Math.max(2, parseInt(nInput.value) || 5)); }

  // Signing below the threshold is deliberately allowed: disabling the button
  // would hide the very property this panel argues for. The button stays live
  // from one signer up, and the real verifier passes judgement.
  function updateSignBtn() {
    const k = getK();
    const count = selectedSigners.size;
    signBtn.disabled = count === 0;
    signBtn.textContent = count > 0 && count < k ? `Sign anyway (${count} of k=${k})` : 'Sign';
    signBtn.title = count === 0
      ? 'Select at least one participant'
      : count < k
        ? `Below the threshold — sign anyway and watch the verifier reject it`
        : '';
  }

  function buildSignerGrid() {
    if (!dealer) return;
    signerGrid.innerHTML = '';
    selectedSigners.clear();
    for (const p of dealer.participants) {
      const pc = makeParticipantCard(p.index, 'signing');
      const toggle = () => {
        if (selectedSigners.has(p.index)) {
          selectedSigners.delete(p.index);
          pc.classList.remove('selected');
          pc.setAttribute('aria-checked', 'false');
        } else {
          selectedSigners.add(p.index);
          pc.classList.add('selected');
          pc.setAttribute('aria-checked', 'true');
        }
        updateSignBtn();
      };
      pc.addEventListener('click', toggle);
      pc.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
      signerGrid.appendChild(pc);
    }
    updateSignBtn();
  }

  // ── Distribute handler ────────────────────────────────────────────────────
  distributeBtn.addEventListener('click', () => {
    const n = getN();
    const k = getK();
    distributeErr.style.display = 'none';
    if (k > n) {
      distributeErr.innerHTML = '';
      distributeErr.appendChild(inlineErr('Threshold k cannot exceed n'));
      distributeErr.style.display = '';
      return;
    }

    try {
      dealer = dealerKeyGen(n, k);
    } catch (e) {
      distributeErr.innerHTML = '';
      distributeErr.appendChild(inlineErr(String(e)));
      distributeErr.style.display = '';
      return;
    }

    noncesMap.clear();
    commitmentsMap.clear();
    selectedSigners.clear();
    participantCardEls.clear();

    // Render participant cards
    participantGrid.innerHTML = '';
    participantGrid.style.display = 'grid';
    for (const p of dealer.participants) {
      const pc = makeParticipantCard(p.index, 'distributed');
      participantCardEls.set(p.index, pc);
      participantGrid.appendChild(pc);
    }

    distributeResult.innerHTML = '';
    distributeResult.appendChild(callout('safe', '✓',
      `Key shares distributed to ${n} participants. The dealer has destroyed the full private key. Each participant holds only their own share.`));

    const pubKeyRow = document.createElement('div');
    pubKeyRow.className = 'col mt-sm';
    pubKeyRow.appendChild(Object.assign(document.createElement('span'), {
      className: 'text-muted text-xs',
      textContent: 'Group public key (Ed25519):',
    }));
    pubKeyRow.appendChild(monoBox(hexOf(dealer.groupPublicKey)));
    distributeResult.appendChild(pubKeyRow);

    // Enable step 2, reset downstream
    unlockStep(step2);
    commitResult.innerHTML = '';
    lockStep(step3);
    signResult.innerHTML = '';
    signErr.style.display = 'none';
  });

  // ── Commit handler ────────────────────────────────────────────────────────
  commitBtn.addEventListener('click', () => {
    if (!dealer) return;
    noncesMap.clear();
    commitmentsMap.clear();

    for (const p of dealer.participants) {
      const { nonces, commitment } = generateCommitment(p.index);
      noncesMap.set(p.index, nonces);
      commitmentsMap.set(p.index, commitment);
    }

    // Update participant cards to show committed state
    for (const pc of participantCardEls.values()) {
      pc.classList.add('committed');
      const sub = pc.querySelector('.participant-sublabel');
      if (sub) sub.textContent = '✓ committed';
    }

    commitResult.innerHTML = '';
    commitResult.appendChild(callout('safe', '✓',
      `${dealer.n} participants generated nonce pairs. Only the commitment values (D_i, E_i) are public — the nonces themselves are secret.`));

    const firstC = commitmentsMap.get(1)!;
    const row = document.createElement('div');
    row.className = 'col mt-sm';
    const dLabel = document.createElement('span');
    dLabel.className = 'text-muted text-xs';
    dLabel.appendChild(document.createTextNode('Participant 1 commitment D (public point of the '));
    dLabel.appendChild(withGlossary('hiding nonce'));
    dLabel.appendChild(document.createTextNode('):'));
    row.appendChild(dLabel);
    row.appendChild(monoBox(hexOf(firstC.D)));
    commitResult.appendChild(row);

    buildSignerGrid();

    unlockStep(step3);
    signResult.innerHTML = '';
    signErr.style.display = 'none';
  });

  // ── Sign handler ──────────────────────────────────────────────────────────
  signBtn.addEventListener('click', () => {
    if (!dealer) return;

    const msg = msgInput.value.trim();
    signErr.style.display = 'none';
    if (!msg) {
      signErr.innerHTML = '';
      signErr.appendChild(inlineErr('Message cannot be empty'));
      signErr.style.display = '';
      return;
    }
    const msgBytes = te.encode(msg);

    const k = getK();
    const signerIndices = [...selectedSigners];
    const belowThreshold = signerIndices.length < k;

    for (const idx of signerIndices) {
      if (!commitmentsMap.has(idx)) {
        signErr.innerHTML = '';
        signErr.appendChild(inlineErr(`Commitment missing for participant ${idx} — run Round 1 first`));
        signErr.style.display = '';
        return;
      }
    }

    try {
      // The identical Round 2 path whatever the signer count. Below k the
      // Lagrange coefficients interpolate the wrong set, so the aggregate does
      // not correspond to the group secret — and the verifier says so.
      const attempt = signWithSubset(dealer, signerIndices, noncesMap, commitmentsMap, msgBytes);

      // Show the partials combining into the aggregate before the verdict.
      renderAggregation(attempt.partials);

      signResult.innerHTML = '';

      if (attempt.verified) {
        signResult.appendChild(callout('safe', '✓',
          `Signature valid. ${signerIndices.length} of ${dealer.n} participants signed without ever assembling the private key. The group public key verifies the result.`));

        const col = document.createElement('div');
        col.className = 'col mt-sm';
        col.appendChild(Object.assign(document.createElement('span'), {
          className: 'text-muted text-xs',
          textContent: 'Ed25519 signature (R || z, 64 bytes):',
        }));
        col.appendChild(monoBox(hexOf(attempt.signature)));
        col.appendChild(Object.assign(document.createElement('p'), {
          className: 'text-xs text-muted mt-sm',
          textContent: 'This is a standard Ed25519 signature. Verified using @noble/curves — the same math as WebCrypto SubtleCrypto.',
        }));
        signResult.appendChild(col);
      } else if (belowThreshold) {
        signResult.appendChild(callout('danger', '✗',
          `Rejected. ${signerIndices.length} participant${signerIndices.length === 1 ? '' : 's'} produced a well-formed 64-byte ` +
          `Ed25519 signature — the arithmetic never complains — and ed25519.verify() against the group public key ` +
          `returned false. k=${k} is not a policy check in this demo; it is the number of points needed to interpolate ` +
          `the group secret at x=0. With ${signerIndices.length}, the Lagrange coefficients reconstruct a different scalar.`));

        const col = document.createElement('div');
        col.className = 'col mt-sm';
        col.appendChild(Object.assign(document.createElement('span'), {
          className: 'text-muted text-xs',
          textContent: 'Rejected signature (R || z, 64 bytes):',
        }));
        col.appendChild(monoBox(hexOf(attempt.signature)));
        col.appendChild(Object.assign(document.createElement('p'), {
          className: 'text-xs text-muted mt-sm',
          textContent: `Select ${k - signerIndices.length} more participant${k - signerIndices.length === 1 ? '' : 's'} and sign again — same code path, and then it verifies.`,
        }));
        signResult.appendChild(col);
      } else {
        signResult.appendChild(callout('danger', '✗',
          'Signature invalid despite a full quorum. This should not occur with correct inputs — check the browser console.'));
      }
    } catch (e) {
      signResult.innerHTML = '';
      signResult.appendChild(callout('danger', '✗', `Signing error: ${e}`));
    }
  });

  // ── Panel control API (used by the page for Run-both / Reset / Compromise) ──
  function reset() {
    dealer = null;
    noncesMap.clear();
    commitmentsMap.clear();
    selectedSigners.clear();
    participantCardEls.clear();
    participantGrid.innerHTML = '';
    participantGrid.style.display = 'none';
    distributeResult.innerHTML = '';
    distributeErr.style.display = 'none';
    commitResult.innerHTML = '';
    signerGrid.innerHTML = '';
    signResult.innerHTML = '';
    signErr.style.display = 'none';
    aggViz.style.display = 'none';
    aggViz.innerHTML = '';
    attackResult.innerHTML = '';
    attackResult.style.display = 'none';
    signBtn.disabled = true;
    lockStep(step2);
    lockStep(step3);
    badge.setState('safe');
    notify('safe');
  }

  async function runAll() {
    reset();
    distributeBtn.click();
    commitBtn.click();
    const k = getK();
    const cards = Array.from(signerGrid.children) as HTMLElement[];
    for (let i = 0; i < k && i < cards.length; i++) cards[i].click();
    signBtn.click(); // FROST signing is synchronous — no await needed
  }

  // The attacker is handed the victim's real secret share and runs the real
  // Round 2 with it. The verdict below is ed25519.verify()'s answer, not a
  // sentence about what would happen.
  function attack() {
    attackResult.style.display = 'block';
    attackResult.innerHTML = '';

    if (!dealer) {
      attackResult.appendChild(callout('info', '😈',
        'Attacker compromised a participant, but no key has been distributed yet. Run the protocol first.'));
      return;
    }

    const victim = dealer.participants[0];
    const pc = participantCardEls.get(victim.index);
    if (pc) pc.classList.add('compromised');

    const msg = msgInput.value.trim() || 'Transfer $1000 to Alice';
    const msgBytes = te.encode(msg);

    try {
      const forged = soloForgeAttempt(dealer, victim.index, msgBytes);

      attackResult.appendChild(callout('info', '😈',
        `Attacker owns P${victim.index} outright and has their real signing share ` +
        `s_${victim.index} = ${shortScalar(victim.secretShare)}. Watch them use it.`));

      const col = document.createElement('div');
      col.className = 'col mt-sm';
      col.appendChild(Object.assign(document.createElement('span'), {
        className: 'text-muted text-xs',
        textContent: `Signature P${victim.index} produced alone over "${msg}" (R || z, 64 bytes):`,
      }));
      col.appendChild(monoBox(hexOf(forged.signature)));
      attackResult.appendChild(col);

      attackResult.appendChild(callout(forged.verified ? 'danger' : 'safe',
        forged.verified ? '✗' : '🛡️',
        forged.verified
          ? 'ed25519.verify() ACCEPTED the solo signature — that would be a break; check the console.'
          : `ed25519.verify(signature, message, groupPublicKey) returned <strong>false</strong>. The bytes are ` +
            `well-formed and the arithmetic ran without error — the share is real — but one share interpolates ` +
            `to the wrong scalar, so the signature does not match the group public key. The attacker needs ` +
            `k=${getK()} cooperating shares, and the private key was never assembled anywhere for them to steal instead.`));

      const note = document.createElement('p');
      note.className = 'text-xs text-muted mt-sm';
      note.textContent = 'Select k participants above and press Sign to watch the identical code path produce a signature that does verify.';
      attackResult.appendChild(note);
    } catch (e) {
      attackResult.appendChild(callout('danger', '✗', `Attack attempt failed to run: ${e}`));
    }
  }

  return {
    el: card,
    runAll,
    reset,
    attack,
    onStateChange: cb => { stateListeners.push(cb); cb('safe'); },
  };
}

function makeParticipantCard(index: number, mode: 'distributed' | 'signing'): HTMLElement {
  const card = document.createElement('div');
  card.className = `participant-card${mode === 'distributed' ? ' distributed' : ''}`;
  card.setAttribute('tabindex', '0');
  if (mode === 'signing') {
    card.setAttribute('role', 'checkbox');
    card.setAttribute('aria-checked', 'false');
    card.setAttribute('aria-label', `Participant ${index}`);
  }

  const icons = ['👤', '👥', '🧑', '👩', '🧔', '👨‍💻', '👩‍💻', '🧑‍💻', '🕵️', '🛡️'];
  const icon = document.createElement('div');
  icon.className = 'participant-icon';
  icon.textContent = icons[(index - 1) % icons.length];
  card.appendChild(icon);

  const lbl = document.createElement('div');
  lbl.className = 'participant-label';
  lbl.textContent = `P${index}`;
  card.appendChild(lbl);

  const sub = document.createElement('div');
  sub.className = 'participant-sublabel';
  sub.textContent = mode === 'distributed' ? '🔒 share' : 'click to select';
  card.appendChild(sub);

  return card;
}
