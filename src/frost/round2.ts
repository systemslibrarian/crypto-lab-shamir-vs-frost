// FROST Round 2 — each selected participant produces a partial signature.
// The private key is NEVER reconstructed; each participant uses only their own share.

import { ed25519 } from '@noble/curves/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import {
  fieldAdd, fieldMul, bytesToScalar, lagrangeCoeff,
} from './field.js';
import type { Nonces, Commitment, PartialSig } from './types.js';

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

// Encode the commitment list deterministically for binding factor computation.
function encodeCommitmentList(commitments: Commitment[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const c of commitments) {
    parts.push(new Uint8Array([c.participantIndex]), c.D, c.E);
  }
  return concat(...parts);
}

// ρ_i = H(i || encodedCommitments || message) mod l
// Simplified binding factor (not verbatim RFC 9591 — no ContextString prefix, for clarity).
function bindingFactor(
  participantIndex: number,
  commitments: Commitment[],
  message: Uint8Array,
): bigint {
  const encoded = encodeCommitmentList(commitments);
  const indexByte = new Uint8Array([participantIndex]);
  const digest = sha512(concat(indexByte, encoded, message));
  return bytesToScalar(digest);
}

// Challenge c = SHA-512(R_bytes || groupPublicKey || message) mod l
// This matches Ed25519's challenge hash (RFC 8032), so the final signature is
// a valid Ed25519 signature verifiable by standard tools.
export function computeChallenge(
  R: Uint8Array,
  groupPublicKey: Uint8Array,
  message: Uint8Array,
): bigint {
  const digest = sha512(concat(R, groupPublicKey, message));
  return bytesToScalar(digest);
}

// Compute the group commitment R = sum(D_i + ρ_i * E_i) for i in signers.
export function groupCommitment(
  commitments: Commitment[],
  message: Uint8Array,
): { R: Uint8Array; bindingFactors: Map<number, bigint> } {
  const bfs = new Map<number, bigint>();
  let R = ed25519.ExtendedPoint.ZERO;

  for (const c of commitments) {
    const rho = bindingFactor(c.participantIndex, commitments, message);
    bfs.set(c.participantIndex, rho);

    const Di = ed25519.ExtendedPoint.fromHex(c.D);
    const Ei = ed25519.ExtendedPoint.fromHex(c.E);
    R = R.add(Di).add(Ei.multiply(rho));
  }

  return { R: R.toRawBytes(), bindingFactors: bfs };
}

export interface Round2Input {
  participantIndex: number;
  secretShare: bigint;
  nonces: Nonces;
  commitment: Commitment;
  signingCommitments: Commitment[];  // all signers' commitments
  groupPublicKey: Uint8Array;
  message: Uint8Array;
  signingIndices: bigint[];          // x-coordinates of all signers
}

export function partialSign(input: Round2Input): PartialSig {
  const {
    participantIndex, secretShare, nonces, signingCommitments,
    groupPublicKey, message, signingIndices,
  } = input;

  const { R, bindingFactors } = groupCommitment(signingCommitments, message);

  const rho_i = bindingFactors.get(participantIndex)!;
  const c = computeChallenge(R, groupPublicKey, message);

  const x_i = BigInt(participantIndex);
  const lambda_i = lagrangeCoeff(x_i, signingIndices);

  // z_i = d_i + e_i * ρ_i + λ_i * s_i * c  (all mod l)
  const z_i = fieldAdd(
    fieldAdd(nonces.d, fieldMul(nonces.e, rho_i)),
    fieldMul(lambda_i, fieldMul(secretShare, c)),
  );

  return { participantIndex, z: z_i };
}

