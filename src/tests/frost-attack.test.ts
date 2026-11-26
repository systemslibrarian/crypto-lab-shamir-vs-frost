import { describe, it, expect } from 'vitest';
import { dealerKeyGen } from '../frost/keygen.js';
import { generateCommitment } from '../frost/round1.js';
import {
  runCompromiseScenario,
  signWithSubset,
  soloForgeAttempt,
} from '../frost/attack.js';
import type { Commitment, Nonces } from '../frost/types.js';
import { reconstruct } from '../shamir/shamir.js';

const te = new TextEncoder();
const MESSAGE = te.encode('Transfer $1000 to Alice');

function commitAll(indices: number[]): {
  noncesMap: Map<number, Nonces>;
  commitmentsMap: Map<number, Commitment>;
} {
  const noncesMap = new Map<number, Nonces>();
  const commitmentsMap = new Map<number, Commitment>();
  for (const index of indices) {
    const { nonces, commitment } = generateCommitment(index);
    noncesMap.set(index, nonces);
    commitmentsMap.set(index, commitment);
  }
  return { noncesMap, commitmentsMap };
}

describe('signing below the threshold', () => {
  it('produces a well-formed signature that the verifier rejects', () => {
    const dealer = dealerKeyGen(5, 3);
    const signers = [1, 2]; // k - 1
    const { noncesMap, commitmentsMap } = commitAll(signers);

    const attempt = signWithSubset(dealer, signers, noncesMap, commitmentsMap, MESSAGE);

    expect(attempt.signature).toHaveLength(64);
    expect(attempt.partials).toHaveLength(2);
    expect(attempt.verified).toBe(false);
  });

  it('verifies as soon as the quorum is reached, on the same code path', () => {
    const dealer = dealerKeyGen(5, 3);
    const signers = [1, 2, 3];
    const { noncesMap, commitmentsMap } = commitAll(signers);

    const attempt = signWithSubset(dealer, signers, noncesMap, commitmentsMap, MESSAGE);

    expect(attempt.verified).toBe(true);
    expect(attempt.signature).toHaveLength(64);
  });

  it('verifies for any k-subset, not just the first k participants', () => {
    const dealer = dealerKeyGen(5, 3);
    const signers = [2, 4, 5];
    const { noncesMap, commitmentsMap } = commitAll(signers);

    expect(signWithSubset(dealer, signers, noncesMap, commitmentsMap, MESSAGE).verified).toBe(true);
  });

  it('rejects a signature aggregated over more shares than were committed', () => {
    const dealer = dealerKeyGen(5, 3);
    const { noncesMap, commitmentsMap } = commitAll([1, 2, 3]);
    expect(() => signWithSubset(dealer, [1, 2, 4], noncesMap, commitmentsMap, MESSAGE))
      .toThrow(/Commitment missing/);
  });
});

describe('soloForgeAttempt', () => {
  it('cannot forge with one real share', () => {
    const dealer = dealerKeyGen(5, 3);
    const attempt = soloForgeAttempt(dealer, 2, MESSAGE);

    expect(attempt.signerIndices).toEqual([2]);
    expect(attempt.signature).toHaveLength(64);
    expect(attempt.verified).toBe(false);
  });

  it('fails for every participant, not just one', () => {
    const dealer = dealerKeyGen(5, 3);
    for (const p of dealer.participants) {
      expect(soloForgeAttempt(dealer, p.index, MESSAGE).verified).toBe(false);
    }
  });

  it('still fails on the message the group is about to sign honestly', () => {
    const dealer = dealerKeyGen(3, 2);
    const forged = soloForgeAttempt(dealer, 1, MESSAGE);
    const { noncesMap, commitmentsMap } = commitAll([1, 2]);
    const honest = signWithSubset(dealer, [1, 2], noncesMap, commitmentsMap, MESSAGE);

    expect(forged.verified).toBe(false);
    expect(honest.verified).toBe(true);
  });
});

describe('runCompromiseScenario', () => {
  it('hands over a real share, rejects the forgery, and still signs honestly', () => {
    const scenario = runCompromiseScenario(5, 3, 2, MESSAGE);
    const victim = scenario.dealer.participants.find(p => p.index === 2)!;

    // The attacker really does hold the participant's secret share.
    expect(scenario.stolenShare).toBe(victim.secretShare);
    expect(scenario.forged.verified).toBe(false);
    expect(scenario.honest.verified).toBe(true);
    // The honest quorum includes the compromised participant.
    expect(scenario.honest.signerIndices).toContain(2);
    expect(scenario.honest.signerIndices).toHaveLength(3);
  });
});

describe('Shamir reconstruction below the threshold', () => {
  const share = (x: number, y: number) => ({ x, y: Uint8Array.of(y) });
  const pair = [share(1, 0x46), share(2, 0x4f)];

  it('the candidate can match or differ from the true secret with identical observed shares', () => {
    expect(reconstruct(pair)).toEqual(Uint8Array.of(0x41));
    expect(reconstruct([...pair, share(3, 0x48)])).toEqual(Uint8Array.of(0x41));
    expect(reconstruct([...pair, share(3, 0x4a)])).toEqual(Uint8Array.of(0x43));
  });

  it('different short subsets can disagree while a quorum uniquely reconstructs', () => {
    const third = share(3, 0x4a);
    const fromFirstTwo = reconstruct(pair);
    const fromFirstAndThird = reconstruct([pair[0], third]);
    const secret = reconstruct([...pair, third]);
    expect(fromFirstTwo).not.toEqual(secret);
    expect(fromFirstAndThird).not.toEqual(secret);
    expect(fromFirstTwo).not.toEqual(fromFirstAndThird);
  });
});
