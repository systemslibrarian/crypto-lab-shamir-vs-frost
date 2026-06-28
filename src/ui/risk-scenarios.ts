// Risk scenario cards — what can an attacker gain at each stage of each protocol?

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

// Scenario 3: FROST participant compromised during signing
function buildFrostCompromiseCard(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'risk-card';

  card.appendChild(Object.assign(document.createElement('div'), {
    className: 'risk-title',
    textContent: '3 · FROST: one participant compromised',
  }));
  card.appendChild(Object.assign(document.createElement('p'), {
    className: 'risk-desc',
    textContent: 'An attacker fully compromises one participant during a signing round. With k=3 of n=5, what do they gain?',
  }));

  let shown = false;
  const btn = document.createElement('button');
  btn.className = 'btn btn-ghost';
  btn.textContent = 'Compromise Participant 2';
  card.appendChild(btn);

  const outcome = document.createElement('div');
  card.appendChild(outcome);

  btn.addEventListener('click', () => {
    shown = !shown;
    btn.textContent = shown ? 'Reset' : 'Compromise Participant 2';
    outcome.innerHTML = '';
    if (shown) {
      // Show participant grid
      const grid = document.createElement('div');
      grid.className = 'participant-grid';
      const labels = ['P1\n(signing)', 'P2\n(⚠ compromised)', 'P3\n(signing)', 'P4\n(not signing)', 'P5\n(not signing)'];
      for (let i = 0; i < 5; i++) {
        const pc = document.createElement('div');
        pc.className = `participant-card ${i === 1 ? 'compromised' : i < 3 ? 'signed' : ''}`;
        pc.appendChild(Object.assign(document.createElement('div'), {
          className: 'participant-icon',
          textContent: i === 1 ? '☠️' : '👤',
        }));
        const lines = labels[i].split('\n');
        pc.appendChild(Object.assign(document.createElement('div'), {
          className: 'participant-label',
          textContent: lines[0],
        }));
        pc.appendChild(Object.assign(document.createElement('div'), {
          className: 'participant-sublabel',
          textContent: lines[1] ?? '',
        }));
        grid.appendChild(pc);
      }
      outcome.appendChild(grid);

      outcome.appendChild(callout('safe', '✓',
        'The attacker learns participant 2\'s signing share — a single value below the threshold. With k=3, they still need 2 more shares to do anything. The group public key is unaffected. Signing with participants 1 and 3 completes normally.'));

      outcome.appendChild(callout('info', 'ℹ',
        'Compare with Shamir: if an attacker intercepts the combiner during reconstruction, the game is over immediately. With FROST, losing one participant is a recoverable event — rotate that participant\'s share.'));
    }
  });

  return card;
}
