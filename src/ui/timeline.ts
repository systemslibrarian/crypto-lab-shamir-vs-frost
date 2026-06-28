// Key-exposure timeline — shows when the private key exists in memory for each protocol.

export function renderTimeline(): HTMLElement {
  const section = document.createElement('div');
  section.className = 'section';

  const title = document.createElement('h3');
  title.className = 'section-title';
  title.textContent = 'Key Exposure Timeline';

  const sub = document.createElement('p');
  sub.className = 'section-subtitle';
  sub.textContent = 'When does the private key actually exist in memory during a signing operation?';

  section.appendChild(title);
  section.appendChild(sub);

  const card = document.createElement('div');
  card.className = 'card';

  const rows: Array<{ label: string; segments: Array<{ text: string; type: 'safe' | 'danger'; flex: number }> }> = [
    {
      label: 'Shamir',
      segments: [
        { text: '📦 Secret split', type: 'safe', flex: 2 },
        { text: '🔴 Reconstruct key', type: 'danger', flex: 2 },
        { text: '🔴 Sign (key in memory)', type: 'danger', flex: 2 },
        { text: '🔴 Until cleared', type: 'danger', flex: 1 },
      ],
    },
    {
      label: 'FROST',
      segments: [
        { text: '📦 Shares distributed', type: 'safe', flex: 2 },
        { text: '✓ Round 1: commitments', type: 'safe', flex: 2 },
        { text: '✓ Round 2: partial sigs', type: 'safe', flex: 2 },
        { text: '✓ Aggregate', type: 'safe', flex: 1 },
      ],
    },
  ];

  for (const row of rows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'timeline-row';

    const labelEl = document.createElement('div');
    labelEl.className = 'timeline-label';
    labelEl.textContent = row.label;
    rowEl.appendChild(labelEl);

    const track = document.createElement('div');
    track.className = 'timeline-track';

    for (const seg of row.segments) {
      const el = document.createElement('div');
      el.className = `timeline-seg ts-${seg.type}`;
      el.style.flex = String(seg.flex);
      el.textContent = seg.text;
      track.appendChild(el);
    }

    rowEl.appendChild(track);
    card.appendChild(rowEl);
  }

  const note = document.createElement('p');
  note.className = 'text-xs text-muted mt-sm';
  note.textContent = 'In Shamir, the private key is exposed during the reconstruction and signing window. In FROST, it never appears in memory on any single machine.';
  card.appendChild(note);

  section.appendChild(card);
  return section;
}
