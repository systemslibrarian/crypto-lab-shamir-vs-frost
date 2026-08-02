// What an attacker who holds real FROST shares can actually produce.
//
// Nothing here is narrated: the attacker is handed genuine secret shares, runs
// the genuine Round 2 arithmetic with them, and the resulting 64 bytes go to the
// same ed25519.verify() the honest path uses. The verdict on screen is that
// verifier's answer.

import { generateCommitment } from './round1.js';
import { partialSign } from './round2.js';
import { aggregate } from './aggregate.js';
import { verifySignature } from './verify.js';
import { dealerKeyGen } from './keygen.js';
import type { Commitment, DealerResult, Nonces, PartialSig } from './types.js';

export interface SigningAttempt {
  signerIndices: number[];
  /** The 64-byte Ed25519 signature the attempt actually produced. */
  signature: Uint8Array;
  /** ed25519.verify() against the group public key — not a stored expectation. */
  verified: boolean;
  partials: PartialSig[];
}

/**
 * Run Round 2 with exactly the given signer set, whatever its size.
 *
 * Below the threshold the Lagrange coefficients are computed over the wrong
 * interpolation set, so the aggregate scalar does not correspond to the group
 * secret and verification fails. That is the property the demo argues for, so
 * the code lets you run it rather than disabling the button.
 */
export function signWithSubset(
  dealer: DealerResult,
  signerIndices: number[],
  noncesMap: Map<number, Nonces>,
  commitmentsMap: Map<number, Commitment>,
  message: Uint8Array,
): SigningAttempt {
  if (signerIndices.length === 0) throw new Error('Select at least one signer');

  const signingIndices = signerIndices.map(BigInt);
  const signingCommitments: Commitment[] = [];

  for (const index of signerIndices) {
    const commitment = commitmentsMap.get(index);
    if (!commitment) throw new Error(`Commitment missing for participant ${index}`);
    signingCommitments.push(commitment);
  }

  const partials: PartialSig[] = signerIndices.map((index) => {
    const participant = dealer.participants.find(p => p.index === index);
    if (!participant) throw new Error(`Unknown participant ${index}`);
    const nonces = noncesMap.get(index);
    if (!nonces) throw new Error(`Nonces missing for participant ${index}`);

    return partialSign({
      participantIndex: index,
      secretShare: participant.secretShare,
      nonces,
      commitment: commitmentsMap.get(index)!,
      signingCommitments,
      groupPublicKey: dealer.groupPublicKey,
      message,
      signingIndices,
    });
  });

  const agg = aggregate(partials, signingCommitments, dealer.groupPublicKey, message);

  return {
    signerIndices: [...signerIndices],
    signature: agg.signature,
    verified: verifySignature(agg, dealer.groupPublicKey, message),
    partials,
  };
}

/**
 * The attacker holds one participant's real secret share and tries to sign on
 * their own. They pick fresh nonces (it is their machine), run the real Round 2,
 * and hand the result to the real verifier.
 */
export function soloForgeAttempt(
  dealer: DealerResult,
  victimIndex: number,
  message: Uint8Array,
): SigningAttempt {
  const { nonces, commitment } = generateCommitment(victimIndex);
  return signWithSubset(
    dealer,
    [victimIndex],
    new Map([[victimIndex, nonces]]),
    new Map([[victimIndex, commitment]]),
    message,
  );
}

export interface CompromiseScenario {
  dealer: DealerResult;
  victimIndex: number;
  /** The real stolen share, so the page can show what the attacker holds. */
  stolenShare: bigint;
  forged: SigningAttempt;
  honest: SigningAttempt;
}

/**
 * Self-contained scenario for the risk card: distribute a fresh k-of-n key,
 * steal one participant's share, watch the solo forgery get rejected, then watch
 * an honest k-subset (including the compromised participant) sign successfully.
 */
export function runCompromiseScenario(
  n: number,
  k: number,
  victimIndex: number,
  message: Uint8Array,
): CompromiseScenario {
  const dealer = dealerKeyGen(n, k);
  const victim = dealer.participants.find(p => p.index === victimIndex);
  if (!victim) throw new Error(`Unknown participant ${victimIndex}`);

  const forged = soloForgeAttempt(dealer, victimIndex, message);

  // An honest quorum of k, chosen to include the compromised participant: the
  // scheme keeps working, which is the other half of the lesson.
  const honestIndices = [victimIndex];
  for (const p of dealer.participants) {
    if (honestIndices.length >= k) break;
    if (p.index !== victimIndex) honestIndices.push(p.index);
  }
  honestIndices.sort((a, b) => a - b);

  const noncesMap = new Map<number, Nonces>();
  const commitmentsMap = new Map<number, Commitment>();
  for (const index of honestIndices) {
    const { nonces, commitment } = generateCommitment(index);
    noncesMap.set(index, nonces);
    commitmentsMap.set(index, commitment);
  }

  const honest = signWithSubset(dealer, honestIndices, noncesMap, commitmentsMap, message);

  return { dealer, victimIndex, stolenShare: victim.secretShare, forged, honest };
}
