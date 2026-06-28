// FROST signature verification using @noble/curves (same math as WebCrypto Ed25519).

import { ed25519 } from '@noble/curves/ed25519';
import type { AggSig } from './types.js';

// Verify the FROST aggregate signature against the group public key and message.
// Returns true if and only if z * G == R + c * Y (the Schnorr verification equation).
export function verifySignature(
  sig: AggSig,
  groupPublicKey: Uint8Array,
  message: Uint8Array,
): boolean {
  try {
    return ed25519.verify(sig.signature, message, groupPublicKey);
  } catch {
    return false;
  }
}
