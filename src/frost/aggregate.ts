// FROST signature aggregation — combines partial signatures into one Ed25519 signature.
// The aggregate secret key is NEVER computed here; only partial z_i values are summed.

import { fieldAdd, scalarToBytes } from './field.js';
import { groupCommitment } from './round2.js';
import type { Commitment, PartialSig, AggSig } from './types.js';

export function aggregate(
  partialSigs: PartialSig[],
  signingCommitments: Commitment[],
  _groupPublicKey: Uint8Array,
  message: Uint8Array,
): AggSig {
  if (partialSigs.length === 0) throw new Error('No partial signatures');

  const { R } = groupCommitment(signingCommitments, message);

  // z = sum(z_i) mod l — no private key reconstruction, just scalar addition
  let z = 0n;
  for (const ps of partialSigs) z = fieldAdd(z, ps.z);

  const zBytes = scalarToBytes(z);
  const signature = new Uint8Array(64);
  signature.set(R, 0);
  signature.set(zBytes, 32);

  return { R, z, signature };
}
