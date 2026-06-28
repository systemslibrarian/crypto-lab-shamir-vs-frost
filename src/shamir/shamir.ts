// Shamir's Secret Sharing over GF(256).
// Splits a secret (Uint8Array, up to 32 bytes) into n shares; any k reconstruct it.
// Each secret byte is treated independently; the polynomial is over GF(256).

import { gfAdd, gfMul, gfDiv, gfPolyEval } from './gf256.js';
import type { Share } from './types.js';

export function split(secret: Uint8Array, n: number, k: number): Share[] {
  if (k < 2) throw new Error('Threshold k must be at least 2');
  if (k > n) throw new Error('Threshold cannot exceed share count (k > n)');
  if (n > 255) throw new Error('n cannot exceed 255');
  if (secret.length === 0) throw new Error('Secret cannot be empty');

  const shares: Share[] = Array.from({ length: n }, (_, i) => ({
    x: i + 1,
    y: new Uint8Array(secret.length),
  }));

  for (let b = 0; b < secret.length; b++) {
    // Random polynomial of degree k-1: coeffs[0] = secret[b]
    const coeffs = new Uint8Array(k);
    coeffs[0] = secret[b];
    crypto.getRandomValues(coeffs.subarray(1));

    for (let i = 0; i < n; i++) {
      shares[i].y[b] = gfPolyEval(coeffs, i + 1);
    }
  }

  return shares;
}

export function reconstruct(shares: Share[]): Uint8Array {
  if (shares.length < 2) throw new Error('Need at least 2 shares');

  const xs = shares.map(s => s.x);
  if (new Set(xs).size !== xs.length) {
    throw new Error('Duplicate share indices detected — reconstruction aborted');
  }
  if (xs.some(x => x < 1 || x > 255)) {
    throw new Error('Share index out of range [1..255]');
  }

  const secretLen = shares[0].y.length;
  const secret = new Uint8Array(secretLen);

  for (let b = 0; b < secretLen; b++) {
    // Lagrange interpolation at x=0
    let result = 0;
    for (let i = 0; i < shares.length; i++) {
      let num = 1;
      let den = 1;
      for (let j = 0; j < shares.length; j++) {
        if (i === j) continue;
        // num *= (0 - x_j) = x_j in GF(256) (subtraction = addition = XOR)
        num = gfMul(num, shares[j].x);
        // den *= (x_i - x_j) = x_i XOR x_j
        den = gfMul(den, gfAdd(shares[i].x, shares[j].x));
      }
      result = gfAdd(result, gfMul(shares[i].y[b], gfDiv(num, den)));
    }
    secret[b] = result;
  }

  return secret;
}

// Returns the polynomial points for visualization.
// coeffs[0] = secret byte (index 0 in the returned y), evaluated at x = 1..maxX.
export function polynomialPoints(
  secretByte: number,
  k: number,
  randomCoeffs: Uint8Array, // length k-1
): Array<{ x: number; y: number }> {
  const coeffs = new Uint8Array(k);
  coeffs[0] = secretByte;
  coeffs.set(randomCoeffs, 1);

  const points: Array<{ x: number; y: number }> = [];
  for (let x = 0; x <= 255; x++) {
    points.push({ x, y: gfPolyEval(coeffs, x) });
  }
  return points;
}
