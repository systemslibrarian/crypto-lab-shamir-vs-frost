// FROST Round 1 — each participant generates a nonce pair and broadcasts commitments.

import { ed25519 } from '@noble/curves/ed25519.js';
import { randomScalar } from './field.js';
import type { Nonces, Commitment } from './types.js';

const G = ed25519.Point.BASE;

export function generateCommitment(participantIndex: number): {
  nonces: Nonces;
  commitment: Commitment;
} {
  const d = randomScalar(); // hiding nonce
  const e = randomScalar(); // binding nonce

  const D = G.multiply(d).toBytes();
  const E = G.multiply(e).toBytes();

  return {
    nonces: { d, e },
    commitment: { participantIndex, D, E },
  };
}
