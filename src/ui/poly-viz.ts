// Polynomial / share visualization — SVG rendering of share points.
// Note: GF(256) doesn't have a natural real-number embedding.
// This visualization plots share (x, y) values on integer axes for educational intuition.

interface SharePoint { x: number; y: number; selected?: boolean; }

const W = 280, H = 110;
const PAD = { left: 30, right: 10, top: 10, bottom: 20 };

function mapX(x: number, n: number): number {
  return PAD.left + (x / n) * (W - PAD.left - PAD.right);
}
function mapY(y: number): number {
  return PAD.top + (1 - y / 255) * (H - PAD.top - PAD.bottom);
}

export function renderPolyViz(
  shares: SharePoint[],
  secretByte: number | null,
): SVGSVGElement {
  const n = shares.length;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'poly-viz');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Share point visualization');

  // Axes
  const axesG = makeSvgEl('g');

  // Y axis
  const yAxis = makeSvgEl('line');
  setAttrs(yAxis, { x1: PAD.left, y1: PAD.top, x2: PAD.left, y2: H - PAD.bottom, stroke: 'var(--border)', 'stroke-width': '1' });
  axesG.appendChild(yAxis);

  // X axis
  const xAxis = makeSvgEl('line');
  setAttrs(xAxis, { x1: PAD.left, y1: H - PAD.bottom, x2: W - PAD.right, y2: H - PAD.bottom, stroke: 'var(--border)', 'stroke-width': '1' });
  axesG.appendChild(xAxis);

  // X axis label
  const xLabel = makeSvgEl('text');
  setAttrs(xLabel, { x: W - PAD.right, y: H - 4, 'font-size': '9', fill: 'var(--text-muted)', 'text-anchor': 'end' });
  xLabel.textContent = 'participant index';
  axesG.appendChild(xLabel);

  // Y axis label
  const yLabel = makeSvgEl('text');
  setAttrs(yLabel, { x: 2, y: PAD.top + 4, 'font-size': '9', fill: 'var(--text-muted)' });
  yLabel.textContent = 'y';
  axesG.appendChild(yLabel);

  svg.appendChild(axesG);

  // Connect share points with a faint polyline (conceptual curve)
  if (shares.length >= 2) {
    const pts = shares.map(s => `${mapX(s.x, n)},${mapY(s.y)}`).join(' ');
    const polyline = makeSvgEl('polyline');
    setAttrs(polyline, { points: pts, fill: 'none', stroke: 'var(--border)', 'stroke-width': '1.5', 'stroke-dasharray': '3 2' });
    svg.appendChild(polyline);
  }

  // Secret at x=0 (if known — only after reconstruction)
  if (secretByte !== null) {
    const cx = PAD.left;
    const cy = mapY(secretByte);
    const secretDot = makeSvgEl('circle');
    setAttrs(secretDot, { cx, cy, r: '5', fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': '2' });
    svg.appendChild(secretDot);

    const secretLabel = makeSvgEl('text');
    // --accent-text, not --accent: --accent is the shape fill (used for the dot
    // just above) and measures 3.02:1 as ink on the panel. The lab already
    // defines --accent-text for exactly this.
    setAttrs(secretLabel, { x: cx + 7, y: cy + 4, 'font-size': '9', fill: 'var(--accent-text)' });
    secretLabel.textContent = `secret=0x${secretByte.toString(16).padStart(2, '0')}`;
    svg.appendChild(secretLabel);
  }

  // Share points
  for (const s of shares) {
    const cx = mapX(s.x, n);
    const cy = mapY(s.y);
    const dot = makeSvgEl('circle');
    const color = s.selected ? 'var(--accent)' : 'var(--text-muted)';
    setAttrs(dot, { cx, cy, r: s.selected ? '5' : '3.5', fill: color, stroke: 'var(--surface)', 'stroke-width': '1.5' });
    svg.appendChild(dot);

    // Index label
    const lbl = makeSvgEl('text');
    setAttrs(lbl, {
      x: cx,
      y: cy - 7,
      'font-size': '9',
      // Ink, not the dot's fill — see the note above.
      fill: s.selected ? 'var(--accent-text)' : 'var(--text-muted)',
      'text-anchor': 'middle',
    });
    lbl.textContent = `S${s.x}`;
    svg.appendChild(lbl);
  }

  // Caption
  const caption = makeSvgEl('text');
  setAttrs(caption, { x: W / 2, y: H - 2, 'font-size': '8', fill: 'var(--text-muted)', 'text-anchor': 'middle' });
  caption.textContent = 'Conceptual — GF(256) values plotted on integer axes';
  svg.appendChild(caption);

  return svg as unknown as SVGSVGElement;
}

function makeSvgEl(tag: string): Element {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function setAttrs(el: Element, attrs: Record<string, string | number>) {
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
}
