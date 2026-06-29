// KeyInMemoryBadge — tracks whether the full private key is currently in memory.
// This is the central visual metaphor of the demo.

export type KeyState = 'neutral' | 'safe' | 'warn';

export interface KeyBadgeHandle {
  el: HTMLElement;
  setState(state: KeyState): void;
}

// Control surface each interactive panel exposes so the page can drive both
// protocols in lockstep, reset them, run the attacker overlay, and mirror the
// live key-in-memory state into the verdict strip.
export interface PanelHandle {
  el: HTMLElement;
  runAll: () => Promise<void>;
  reset: () => void;
  attack: () => void;
  onStateChange: (cb: (state: KeyState) => void) => void;
}

export function createKeyBadge(initialState: KeyState = 'neutral'): KeyBadgeHandle {
  const el = document.createElement('span');
  el.className = 'key-badge';
  el.setAttribute('aria-live', 'polite');

  function setState(state: KeyState) {
    el.className = `key-badge state-${state}`;
    if (state === 'warn') {
      el.textContent = '⚠ Private key in memory';
    } else if (state === 'safe') {
      el.textContent = '✓ Key never reconstructed';
    } else {
      el.textContent = '○ Awaiting operation';
    }
  }

  setState(initialState);
  return { el, setState };
}
