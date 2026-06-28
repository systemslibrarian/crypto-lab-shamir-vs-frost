// FROST key generation — trusted dealer model.
// [extension] Replace dealerKeyGen with a Pedersen DKG protocol to remove the trusted-dealer assumption.

import { ed25519 } from '@noble/curves/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { bytesToScalar, scalarShamirSplit } from './field.js';
import type { DealerResult } from './types.js';

const G = ed25519.ExtendedPoint.BASE;

// Expand a raw 32-byte Ed25519 private key to its signing scalar and public key.
// This matches the Ed25519 key derivation (RFC 8032 §5.1.5).
function expandPrivateKey(priv: Uint8Array): { scalar: bigint; publicKeyBytes: Uint8Array } {
  const h = sha512(priv);
  const a = h.slice(0, 32);
  // Clamp: clear bottom 3 bits, clear top 2, set second-top bit
  a[0] &= 248;
  a[31] &= 63;
  a[31] |= 64;
  const scalar = bytesToScalar(a); // interpret as LE bigint, mod l
  const publicKeyBytes = G.multiply(scalar).toRawBytes();
  return { scalar, publicKeyBytes };
}

export function dealerKeyGen(n: number, k: number): DealerResult {
  if (k < 2) throw new Error('k must be >= 2');
  if (k > n) throw new Error('k cannot exceed n');
  if (n > 10) throw new Error('n capped at 10 for this demo');

  // Generate the group private key and derive its public key
  const priv = ed25519.utils.randomPrivateKey();
  const { scalar: groupSecret, publicKeyBytes: groupPublicKey } = expandPrivateKey(priv);

  // Split the group secret scalar across n participants using Shamir in Z_l
  const shareScalars = scalarShamirSplit(groupSecret, n, k);

  const participants = shareScalars.map((s, i) => ({
    index: i + 1,
    secretShare: s,
    publicShare: G.multiply(s).toRawBytes(), // S_i = s_i * G
  }));

  return { groupPublicKey, participants, n, k };
}
