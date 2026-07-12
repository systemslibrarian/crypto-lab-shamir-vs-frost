import './styles.css';
import { renderComparisonTable } from './ui/comparison-table.js';
import { renderShamirPanel } from './ui/shamir-panel.js';
import { renderFrostPanel } from './ui/frost-panel.js';
import { renderTimeline } from './ui/timeline.js';
import { renderRiskScenarios } from './ui/risk-scenarios.js';
import { renderDecisionGuide } from './ui/decision-guide.js';

const app = document.getElementById('app')!;

// ── Page hero ────────────────────────────────────────────────────────────────
const hero = document.createElement('div');
hero.className = 'cl-hero';
hero.innerHTML = `
  <div class="cl-hero-main">
    <h1 class="cl-hero-title">Shamir vs FROST</h1>
    <p class="cl-hero-sub">Secret Sharing · Threshold Signatures</p>
    <p class="cl-hero-desc">Run both schemes side-by-side and watch the key badges diverge: Shamir reassembles the private key in memory to use it, while FROST signs without ever assembling it on any machine.</p>
  </div>
  <aside class="cl-hero-why" aria-label="Why it matters">
    <span class="cl-hero-why-label">WHY IT MATTERS</span>
    <p class="cl-hero-why-text">The instant a key is reconstructed, that machine becomes a single point of total compromise. Threshold signing removes that window entirely — the whole reason it now guards custody wallets, root CAs, and validator keys.</p>
  </aside>
`;
app.appendChild(hero);

// ── Section 1: Comparison table ──────────────────────────────────────────────
app.appendChild(renderComparisonTable());

// ── Section 2: Interactive head-to-head ─────────────────────────────────────
const headToHead = document.createElement('section');
headToHead.className = 'section';

const h2Title = document.createElement('h2');
h2Title.className = 'section-title';
h2Title.textContent = 'Interactive Head-to-Head';

const h2Sub = document.createElement('p');
h2Sub.className = 'section-subtitle';
h2Sub.textContent = 'Walk through both protocols side-by-side — or hit Run both and watch the key badges diverge. Then compromise a machine and see who survives.';

headToHead.appendChild(h2Title);
headToHead.appendChild(h2Sub);

// ── Panel handles + shared drivers ──────────────────────────────────────────
const shamir = renderShamirPanel();
const frost = renderFrostPanel();

const controls = document.createElement('div');
controls.className = 'h2h-controls';

const runBothBtn = document.createElement('button');
runBothBtn.className = 'btn btn-primary';
runBothBtn.innerHTML = '▶ Run both';
runBothBtn.setAttribute('aria-label', 'Run both protocols end to end');

const attackBtn = document.createElement('button');
attackBtn.className = 'btn btn-ghost';
attackBtn.innerHTML = '😈 Compromise a machine';
attackBtn.setAttribute('aria-label', 'Compromise a machine');

const resetBtn = document.createElement('button');
resetBtn.className = 'btn btn-ghost';
resetBtn.textContent = '↺ Reset';
resetBtn.setAttribute('aria-label', 'Reset both protocols');

runBothBtn.addEventListener('click', async () => {
  runBothBtn.disabled = true;
  attackBtn.disabled = true;
  try {
    await Promise.all([shamir.runAll(), frost.runAll()]);
  } finally {
    runBothBtn.disabled = false;
    attackBtn.disabled = false;
  }
});
attackBtn.addEventListener('click', () => { shamir.attack(); frost.attack(); });
resetBtn.addEventListener('click', () => { shamir.reset(); frost.reset(); });

controls.appendChild(runBothBtn);
controls.appendChild(attackBtn);
controls.appendChild(resetBtn);
headToHead.appendChild(controls);

const twoPanels = document.createElement('div');
twoPanels.className = 'two-panel';
twoPanels.appendChild(shamir.el);
twoPanels.appendChild(frost.el);
headToHead.appendChild(twoPanels);

// ── Live verdict strip ──────────────────────────────────────────────────────
const verdict = document.createElement('div');
verdict.className = 'verdict-strip';
const vShamir = document.createElement('div');
vShamir.className = 'verdict-cell vc-shamir';
vShamir.setAttribute('role', 'status');
vShamir.setAttribute('aria-live', 'polite');
const vFrost = document.createElement('div');
vFrost.className = 'verdict-cell vc-frost';
vFrost.setAttribute('role', 'status');
vFrost.setAttribute('aria-live', 'polite');
verdict.appendChild(vShamir);
verdict.appendChild(vFrost);
headToHead.appendChild(verdict);

function paintVerdict(cell: HTMLElement, name: string, reconstructed: boolean) {
  cell.classList.toggle('vc-warn', reconstructed);
  cell.classList.toggle('vc-safe', !reconstructed);
  cell.innerHTML =
    `<span class="verdict-name">${name}</span>` +
    `<span class="verdict-answer">Key ever reconstructed? ` +
    `<strong>${reconstructed ? 'YES — it sat in memory' : 'NO — never assembled'}</strong></span>`;
}
shamir.onStateChange(s => paintVerdict(vShamir, "Shamir's SSS", s === 'warn'));
frost.onStateChange(() => paintVerdict(vFrost, 'FROST', false));

app.appendChild(headToHead);

// ── Section 3: Timeline ──────────────────────────────────────────────────────
app.appendChild(renderTimeline());

// ── Section 4: Risk scenarios ────────────────────────────────────────────────
app.appendChild(renderRiskScenarios());

// ── Section 5: Decision guide ────────────────────────────────────────────────
app.appendChild(renderDecisionGuide());
