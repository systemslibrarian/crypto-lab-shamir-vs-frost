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
hero.style.cssText = 'margin-bottom:2.5rem';
hero.innerHTML = `
  <h1 style="font-size:1.9rem;font-weight:800;margin-bottom:0.4rem">Threshold Lab</h1>
  <p style="color:var(--text-muted);font-size:1rem;max-width:680px">
    Shamir's Secret Sharing vs FROST threshold signatures — the same concept,
    a critically different security property. <strong style="color:var(--text)">One reconstructs the key. The other never does.</strong>
  </p>
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
h2Sub.textContent = 'Walk through both protocols side-by-side. Watch the key badge — it tracks real architectural state.';

headToHead.appendChild(h2Title);
headToHead.appendChild(h2Sub);

const twoPanels = document.createElement('div');
twoPanels.className = 'two-panel';
twoPanels.appendChild(renderShamirPanel());
twoPanels.appendChild(renderFrostPanel());
headToHead.appendChild(twoPanels);

app.appendChild(headToHead);

// ── Section 3: Timeline ──────────────────────────────────────────────────────
app.appendChild(renderTimeline());

// ── Section 4: Risk scenarios ────────────────────────────────────────────────
app.appendChild(renderRiskScenarios());

// ── Section 5: Decision guide ────────────────────────────────────────────────
app.appendChild(renderDecisionGuide());
