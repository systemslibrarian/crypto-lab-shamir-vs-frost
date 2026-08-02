// Risk scenario cards — what can an attacker gain at each stage of each protocol?

import { runCompromiseScenario, type CompromiseScenario } from '../frost/attack.js';
import { scalarToBytes } from '../frost/field.js';

const te = new TextEncoder();

function hexOf(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Compact label for a scalar: first and last bytes of its 32-byte encoding.
function shortScalar(s: bigint): string {
  const hx = hexOf(scalarToBytes(s));
  return `${hx.slice(0, 6)}\u2026${hx.slice(-4)}`;
}

export function renderRiskScenarios(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'section';

  section.appendChild(Object.assign(document.createElement('h2'), {
    className: 'section-title',
    textContent: 'Risk Scenarios',
  }));
  section.appendChild(Object.assign(document.createElement('p'), {
    className: 'section-subtitle',
    textContent: 'Interactive: see what an adversary gains at each stage.',
  }));

  const grid = document.createElement('div');
  grid.className = 'risk-grid';

  grid.appendChild(buildShareStealCard());
  grid.appendChild(buildReconstructInterceptCard());
  grid.appendChild(buildFrostCompromiseCard());

  section.appendChild(grid);
  return section;
}

function callout(type: 'warn' | 'safe' | 'danger' | 'info', icon: string, text: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `callout callout-${type} fade-in`;
  el.innerHTML = `<span class="callout-icon">${icon}</span><span>${text}</span>`;
  return el;
}

// Scenario 1: Shamir shares stolen before reconstruction
function buildShareStealCard(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'risk-card';

  card.appendChild(Object.assign(document.createElement('div'), {
    className: 'risk-title',
    textContent: '1 · Shamir: shares stolen before reconstruction',
  }));
  card.appendChild(Object.assign(document.createElement('p'), {
    className: 'risk-desc',
    textContent: 'Drag the slider to see how many shares an attacker has captured. The threshold is k=3 of n=5.',
  }));

  const k = 3, n = 5;

  // Slider
  let stolen = 1;
  const sliderRow = document.createElement('div');
  sliderRow.className = 'slider-row';
  sliderRow.appendChild(Object.assign(document.createElement('span'), { textContent: 'Shares stolen:' }));
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(n);
  slider.value = '1';
  slider.setAttribute('aria-label', 'Number of shares stolen');
  const valDisplay = document.createElement('span');
  valDisplay.className = 'slider-val';
  valDisplay.textContent = '1';
  sliderRow.appendChild(slider);
  sliderRow.appendChild(valDisplay);
  card.appendChild(sliderRow);

  const progress = document.createElement('p');
  progress.className = 'text-xs text-muted mb-sm';
  card.appendChild(progress);

  const outcome = document.createElement('div');
  card.appendChild(outcome);

  function update() {
    stolen = parseInt(slider.value);
    valDisplay.textContent = String(stolen);
    progress.textContent = `Attacker has ${stolen} of ${k} shares needed.`;
    outcome.innerHTML = '';
    if (stolen >= k) {
      outcome.appendChild(callout('warn', '⚠',
        `With ${stolen} shares (≥ threshold k=${k}), the attacker can reconstruct the full secret immediately — no time pressure.`));
    } else if (stolen > 0) {
      outcome.appendChild(callout('safe', '✓',
        `With only ${stolen} share${stolen > 1 ? 's' : ''} (< threshold k=${k}), the attacker learns nothing about the secret. They need ${k - stolen} more.`));
    } else {
      outcome.appendChild(callout('info', 'ℹ',
        'No shares stolen. The attacker has no information about the secret.'));
    }
  }
  slider.addEventListener('input', update);
  update();

  return card;
}

// Scenario 2: Shamir reconstruction step intercepted
function buildReconstructInterceptCard(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'risk-card';

  card.appendChild(Object.assign(document.createElement('div'), {
    className: 'risk-title',
    textContent: '2 · Shamir: reconstruction step intercepted',
  }));
  card.appendChild(Object.assign(document.createElement('p'), {
    className: 'risk-desc',
    textContent: 'Even with zero shares, an attacker who can observe memory, swap space, or the CPU during reconstruction gains the full key.',
  }));

  let shown = false;
  const btn = document.createElement('button');
  btn.className = 'btn btn-ghost';
  btn.textContent = 'Simulate reconstruction interception';
  card.appendChild(btn);

  const outcome = document.createElement('div');
  card.appendChild(outcome);

  btn.addEventListener('click', () => {
    shown = !shown;
    btn.textContent = shown ? 'Reset' : 'Simulate reconstruction interception';
    outcome.innerHTML = '';
    if (shown) {
      outcome.appendChild(callout('warn', '⚠',
        'During Shamir reconstruction, the full private key exists as a plaintext value in memory. Cold-boot attacks, memory dumps, swap files, or a compromised combiner process can extract it — even if all shares were held securely before this moment.'));

      const ul = document.createElement('ul');
      ul.style.cssText = 'margin: 0.5rem 0 0 1.2rem; font-size: 0.82rem; color: var(--text-muted); line-height:1.6';
      for (const item of [
        'Cold-boot attack: RAM snapshots after power loss',
        'Memory scraper: malware reading process heap',
        'Swap / paging: OS writes key to disk',
        'Trusted combiner: single point of failure by design',
      ]) {
        ul.appendChild(Object.assign(document.createElement('li'), { textContent: item }));
      }
      outcome.appendChild(ul);
    }
  });

  return card;
}

// Scenario 3: FROST participant compromised during signing.
//
// This card runs the scenario rather than describing it: a fresh 3-of-5 key is
// distributed, P2's real secret share is handed to the attacker, and both the
// solo forgery and the honest quorum go to the real ed25519 verifier. The two
// verdicts printed below are that verifier's answers.
function buildFrostCompromiseCard(): HTMLElement {
  const N = 5, K = 3, VICTIM = 2;
  const MESSAGE = 'Transfer $1000 to Alice';

  const card = document.createElement('div');
  card.className = 'risk-card';

  card.appendChild(Object.assign(document.createElement('div'), {
    className: 'risk-title',
    textContent: '3 \u00b7 FROST: one participant compromised',
  }));
  card.appendChild(Object.assign(document.createElement('p'), {
    className: 'risk-desc',
    textContent: `An attacker fully compromises one participant during a signing round. With k=${K} of n=${N}, what do they gain? Press the button and the attacker actually tries.`,
  }));

  let shown = false;
  const btn = document.createElement('button');
  btn.className = 'btn btn-ghost';
  btn.textContent = 'Compromise Participant 2';
  card.appendChild(btn);

  const outcome = document.createElement('div');
  outcome.setAttribute('role', 'status');
  outcome.setAttribute('aria-live', 'polite');
  card.appendChild(outcome);

  btn.addEventListener('click', () => {
    shown = !shown;
    btn.textContent = shown ? 'Reset' : 'Compromise Participant 2';
    outcome.innerHTML = '';
    if (!shown) return;

    let scenario: CompromiseScenario;
    try {
      scenario = runCompromiseScenario(N, K, VICTIM, te.encode(MESSAGE));
    } catch (e) {
      outcome.appendChild(callout('warn', '\u2717', `Scenario failed to run: ${e}`));
      return;
    }

    const signers = new Set(scenario.honest.signerIndices);

    const grid = document.createElement('div');
    grid.className = 'participant-grid';
    for (let i = 1; i <= N; i++) {
      const compromised = i === VICTIM;
      const signing = signers.has(i);
      const pc = document.createElement('div');
      pc.className = `participant-card ${compromised ? 'compromised' : signing ? 'signed' : ''}`;
      pc.appendChild(Object.assign(document.createElement('div'), {
        className: 'participant-icon',
        textContent: compromised ? '\u2620\ufe0f' : '\ud83d\udc64',
      }));
      pc.appendChild(Object.assign(document.createElement('div'), {
        className: 'participant-label',
        textContent: `P${i}`,
      }));
      pc.appendChild(Object.assign(document.createElement('div'), {
        className: 'participant-sublabel',
        textContent: compromised ? '\u26a0 compromised' : signing ? '(signing)' : '(not signing)',
      }));
      grid.appendChild(pc);
    }
    outcome.appendChild(grid);

    outcome.appendChild(callout('info', '\ud83d\ude08',
      `The attacker holds P${VICTIM}'s real signing share s_${VICTIM} = ${shortScalar(scenario.stolenShare)} ` +
      `and signs "${MESSAGE}" with it alone.`));

    const forgedRow = document.createElement('div');
    forgedRow.className = 'col mt-sm';
    forgedRow.appendChild(Object.assign(document.createElement('span'), {
      className: 'text-muted text-xs',
      textContent: 'Signature produced by the stolen share alone (R || z, 64 bytes):',
    }));
    const forgedHex = document.createElement('code');
    forgedHex.className = 'font-mono text-xs';
    forgedHex.style.cssText = 'word-break: break-all; display:block;';
    forgedHex.textContent = hexOf(scenario.forged.signature);
    forgedRow.appendChild(forgedHex);
    outcome.appendChild(forgedRow);

    outcome.appendChild(callout(scenario.forged.verified ? 'warn' : 'safe',
      scenario.forged.verified ? '\u26a0' : '\ud83d\udee1\ufe0f',
      scenario.forged.verified
        ? 'ed25519.verify() ACCEPTED the solo signature \u2014 that would be a break in this implementation.'
        : `<strong>ed25519.verify() returned false.</strong> The share is genuine and the arithmetic ran to ` +
          `completion \u2014 a real 64-byte signature came out \u2014 but one point cannot pin down a ` +
          `degree-${K - 1} polynomial, so the aggregate scalar does not match the group public key. The attacker ` +
          `still needs ${K - 1} more shares.`));

    outcome.appendChild(callout(scenario.honest.verified ? 'safe' : 'warn',
      scenario.honest.verified ? '\u2713' : '\u2717',
      scenario.honest.verified
        ? `The honest quorum P${scenario.honest.signerIndices.join(', P')} \u2014 including the compromised ` +
          `P${VICTIM} \u2014 then signed the same message and <strong>ed25519.verify() returned true</strong>. ` +
          `Losing one participant does not stop the group, and the group public key never changed.`
        : 'The honest quorum failed to verify \u2014 that should not happen; check the console.'));

    outcome.appendChild(callout('info', '\u2139',
      'Compare with Shamir: if an attacker intercepts the combiner during reconstruction, the game is over immediately. With FROST, losing one participant is a recoverable event \u2014 rotate that participant\u2019s share.'));
  });

  return card;
}
