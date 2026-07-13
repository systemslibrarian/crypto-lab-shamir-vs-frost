// Interpolation teaching widget for Shamir's Secret Sharing.
//
// WHY A SEPARATE, REAL-NUMBER VIEW:
// The security claim "any k shares reconstruct the secret, any k−1 reveal
// nothing" is a property of Lagrange interpolation, which holds over ANY field.
// The real Shamir implementation runs over GF(256), whose values do NOT embed
// into the real number line as a smooth curve — so plotting GF(256) bytes and
// drawing a "curve" through them would be a lie. Instead this widget teaches the
// underlying THEOREM honestly, using the SAME polynomial arithmetic in miniature
// over small real integers, where the smooth curve is mathematically faithful:
//   - k points uniquely pin down one degree-(k−1) polynomial → secret at x=0 is
//     forced to a single value.
//   - k−1 points leave one degree of freedom → infinitely many curves pass
//     through them, and the value at x=0 can be ANYTHING (perfect secrecy).
// Every curve drawn here is a real polynomial actually evaluated at each x; none
// are faked. The GF(256) values remain the honest crypto in the panel above.

interface InterpPoint { x: number; y: number; }

const W = 320, H = 200;
const PAD = { left: 34, right: 14, top: 14, bottom: 26 };
// Real-number teaching domain: x in [0..6], y in [0..10].
const X_MAX = 6, Y_MAX = 10;

function mapX(x: number): number {
  return PAD.left + (x / X_MAX) * (W - PAD.left - PAD.right);
}
function mapY(y: number): number {
  return PAD.top + (1 - y / Y_MAX) * (H - PAD.top - PAD.bottom);
}

function svgEl(tag: string): Element {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}
function setAttrs(el: Element, attrs: Record<string, string | number>) {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
}

// Solve for the unique degree-(m−1) polynomial through m points via Lagrange,
// returned as a sampled path over the visible x-range.
function lagrangePath(points: InterpPoint[], samples = 80): string {
  const parts: string[] = [];
  for (let s = 0; s <= samples; s++) {
    const x = (s / samples) * X_MAX;
    let y = 0;
    for (let i = 0; i < points.length; i++) {
      let term = points[i].y;
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        term *= (x - points[j].x) / (points[i].x - points[j].x);
      }
      y += term;
    }
    parts.push(`${mapX(x).toFixed(1)},${mapY(y).toFixed(1)}`);
  }
  return parts.join(' ');
}

// Build a path for the unique degree-(m−1) polynomial through the given points
// plus one extra "free" point at x=0 forced to freeY — i.e. a curve that agrees
// with all k−1 shares but chooses an arbitrary secret. Used to fan the curves.
function pathThroughPlusSecret(points: InterpPoint[], freeY: number): string {
  return lagrangePath([{ x: 0, y: freeY }, ...points]);
}

export interface InterpVizHandle {
  el: SVGSVGElement;
}

/**
 * @param sharePts    The k−1 or k selected teaching share points (x≥1).
 * @param locked      true when exactly k points are selected → draw the ONE
 *                    solved curve and reveal the secret at x=0 (animated snap).
 * @param k           threshold (curve degree is k−1).
 */
export function renderInterpViz(
  sharePts: InterpPoint[],
  locked: boolean,
  k: number,
): SVGSVGElement {
  const svg = svgEl('svg') as SVGSVGElement;
  setAttrs(svg, { viewBox: `0 0 ${W} ${H}`, class: 'interp-viz', role: 'img' });

  const degree = Math.max(1, k - 1);
  const caption = locked
    ? `k=${k} points selected — exactly one degree-${degree} curve fits, so the secret at x=0 is now forced.`
    : `${sharePts.length} of k=${k} points selected — infinitely many degree-${degree} curves still fit, so the secret at x=0 could be anything.`;
  svg.setAttribute('aria-label', `Polynomial interpolation intuition. ${caption}`);

  // ── grid + axes ──────────────────────────────────────────────────────────
  const g = svgEl('g');
  for (let gx = 0; gx <= X_MAX; gx++) {
    const line = svgEl('line');
    setAttrs(line, { x1: mapX(gx), y1: mapY(0), x2: mapX(gx), y2: mapY(Y_MAX), stroke: 'var(--border)', 'stroke-width': gx === 0 ? '1.5' : '0.5', opacity: gx === 0 ? '1' : '0.5' });
    g.appendChild(line);
  }
  const xAxis = svgEl('line');
  setAttrs(xAxis, { x1: mapX(0), y1: mapY(0), x2: mapX(X_MAX), y2: mapY(0), stroke: 'var(--border)', 'stroke-width': '1' });
  g.appendChild(xAxis);
  svg.appendChild(g);

  // x=0 emphasis label ("the secret lives here")
  const secretAxisLbl = svgEl('text');
  setAttrs(secretAxisLbl, { x: mapX(0), y: H - 8, 'font-size': '9', fill: 'var(--accent-text)', 'text-anchor': 'middle', 'font-weight': '700' });
  secretAxisLbl.textContent = 'x=0 (secret)';
  svg.appendChild(secretAxisLbl);

  const xAxisLbl = svgEl('text');
  setAttrs(xAxisLbl, { x: W - PAD.right, y: H - 8, 'font-size': '9', fill: 'var(--text-muted)', 'text-anchor': 'end' });
  xAxisLbl.textContent = 'share index →';
  svg.appendChild(xAxisLbl);

  if (!locked && sharePts.length >= 1) {
    // ── Fan of candidate curves through the k−1 points ──────────────────────
    // Each passes through all selected shares but takes a DIFFERENT secret at
    // x=0 — the visual proof that k−1 shares leave the secret undetermined.
    const secretGuesses = [1, 3, 5, 7, 9];
    for (const gy of secretGuesses) {
      const poly = svgEl('polyline');
      setAttrs(poly, {
        points: pathThroughPlusSecret(sharePts, gy),
        fill: 'none', stroke: 'var(--accent)', 'stroke-width': '1',
        opacity: '0.35', 'stroke-dasharray': '3 3',
      });
      svg.appendChild(poly);
      // ghost secret dot at x=0 for this candidate
      const dot = svgEl('circle');
      setAttrs(dot, { cx: mapX(0), cy: mapY(gy), r: '2.5', fill: 'var(--accent)', opacity: '0.35' });
      svg.appendChild(dot);
    }
    const q = svgEl('text');
    setAttrs(q, { x: mapX(0) + 6, y: mapY(Y_MAX) + 6, 'font-size': '11', fill: 'var(--accent-text)', 'font-weight': '700' });
    q.textContent = 'secret = ?';
    svg.appendChild(q);
  }

  if (locked && sharePts.length >= 2) {
    // ── The single solved curve ─────────────────────────────────────────────
    const solved = svgEl('polyline');
    const pathStr = lagrangePath(sharePts);
    setAttrs(solved, {
      points: pathStr, fill: 'none', stroke: 'var(--key-safe)',
      'stroke-width': '2.5', class: 'interp-curve-snap',
    });
    svg.appendChild(solved);

    // Reveal secret at x=0 (evaluate the solved polynomial there).
    const secretY = (() => {
      let y = 0;
      for (let i = 0; i < sharePts.length; i++) {
        let term = sharePts[i].y;
        for (let j = 0; j < sharePts.length; j++) {
          if (i === j) continue;
          term *= (0 - sharePts[j].x) / (sharePts[i].x - sharePts[j].x);
        }
        y += term;
      }
      return y;
    })();
    const clampY = Math.max(0, Math.min(Y_MAX, secretY));
    const secretDot = svgEl('circle');
    setAttrs(secretDot, { cx: mapX(0), cy: mapY(clampY), r: '6', fill: 'var(--key-safe)', stroke: 'var(--surface)', 'stroke-width': '2', class: 'interp-secret-pop' });
    svg.appendChild(secretDot);
    const lbl = svgEl('text');
    setAttrs(lbl, { x: mapX(0) + 9, y: mapY(clampY) + 4, 'font-size': '11', fill: 'var(--key-safe)', 'font-weight': '700' });
    lbl.textContent = 'secret locked';
    svg.appendChild(lbl);
  }

  // ── Selected share points (always on top) ─────────────────────────────────
  for (const p of sharePts) {
    const dot = svgEl('circle');
    setAttrs(dot, { cx: mapX(p.x), cy: mapY(p.y), r: '4.5', fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': '2' });
    svg.appendChild(dot);
    const t = svgEl('text');
    setAttrs(t, { x: mapX(p.x), y: mapY(p.y) - 8, 'font-size': '9', fill: 'var(--accent-text)', 'text-anchor': 'middle', 'font-weight': '700' });
    t.textContent = `S${p.x}`;
    svg.appendChild(t);
  }

  return svg;
}

// Deterministic teaching y-values for a given share index, so the picture is
// stable across re-renders within one split. These are illustrative real
// integers (NOT the GF(256) share bytes) chosen only to look like scattered
// points; the true crypto values live in the share cards above.
export function teachingY(x: number, salt: number): number {
  // simple stable pseudo-value in [1..9]
  const v = ((x * 2654435761 + salt * 40503) >>> 0) % 9;
  return 1 + v;
}
