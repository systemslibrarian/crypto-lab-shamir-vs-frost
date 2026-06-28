import { describe, it, expect } from 'vitest';
import { dealerKeyGen } from '../frost/keygen.js';
import { generateCommitment } from '../frost/round1.js';
import { partialSign } from '../frost/round2.js';
import { aggregate } from '../frost/aggregate.js';
import { verifySignature } from '../frost/verify.js';
import { scalarShamirSplit, lagrangeCoeff, fieldAdd, fieldMul, L } from '../frost/field.js';

const te = new TextEncoder();

describe('FROST field arithmetic (Z_l)', () => {
  it('fieldAdd is commutative', () => {
    const a = 123456789n, b = 987654321n;
    expect(fieldAdd(a, b)).toBe(fieldAdd(b, a));
  });

  it('fieldMul is commutative', () => {
    const a = 999n, b = 777n;
    expect(fieldMul(a, b)).toBe(fieldMul(b, a));
  });

  it('field values are always in [0, l)', () => {
    const large = L - 1n;
    expect(fieldAdd(large, 1n)).toBe(0n);
    expect(fieldMul(large, 2n)).toBe(L - 2n);
  });

  it('Lagrange coefficient for trivial case: one signer at index 1', () => {
    // With a single signer, L_1(0) = (0 - 1)/(1 - ?) ... not defined for 1 signer
    // But with 2 signers at indices [1, 2]:
    // L_1(0) = (0-2)/(1-2) = (-2)/(-1) = 2
    const lam = lagrangeCoeff(1n, [1n, 2n]);
    // (0-2)/(1-2) = (-2)/(-1) = 2 mod l
    expect(lam).toBe(2n);
  });

  it('Shamir scalar split recovers secret', () => {
    const secret = 42n;
    const shares = scalarShamirSplit(secret, 3, 2);
    expect(shares.length).toBe(3);

    // Lagrange interpolation at x=0 using first 2 shares
    const x1 = 1n, x2 = 2n;
    const y1 = shares[0], y2 = shares[1];

    // L_1(0) = (0-2)/(1-2) = (-2)/(-1) = 2
    // L_2(0) = (0-1)/(2-1) = (-1)/(1) = -1 = l-1
    const lam1 = lagrangeCoeff(x1, [x1, x2]);
    const lam2 = lagrangeCoeff(x2, [x1, x2]);

    const recovered = fieldAdd(fieldMul(lam1, y1), fieldMul(lam2, y2));
    expect(recovered).toBe(((secret % L) + L) % L);
  });
});

describe('FROST signing protocol — n=3, k=2', () => {
  it('full signing flow verifies', () => {
    const n = 3, k = 2;
    const msg = te.encode('Transfer $1000 to Alice');

    const dealer = dealerKeyGen(n, k);
    expect(dealer.participants.length).toBe(n);
    expect(dealer.groupPublicKey.length).toBe(32);

    // Round 1: all participants generate commitments
    const noncesMap = new Map<number, ReturnType<typeof generateCommitment>['nonces']>();
    const commitmentsMap = new Map<number, ReturnType<typeof generateCommitment>['commitment']>();

    for (const p of dealer.participants) {
      const { nonces, commitment } = generateCommitment(p.index);
      noncesMap.set(p.index, nonces);
      commitmentsMap.set(p.index, commitment);
    }

    // Round 2: participants 1 and 2 sign
    const signers = [1, 2];
    const signingIndices = signers.map(BigInt);
    const signingCommitments = signers.map(i => commitmentsMap.get(i)!);

    const partialSigs = signers.map(idx => {
      const p = dealer.participants.find(x => x.index === idx)!;
      return partialSign({
        participantIndex: idx,
        secretShare: p.secretShare,
        nonces: noncesMap.get(idx)!,
        commitment: commitmentsMap.get(idx)!,
        signingCommitments,
        groupPublicKey: dealer.groupPublicKey,
        message: msg,
        signingIndices,
      });
    });

    // Aggregate
    const aggSig = aggregate(partialSigs, signingCommitments, dealer.groupPublicKey, msg);
    expect(aggSig.signature.length).toBe(64);

    // Verify
    const valid = verifySignature(aggSig, dealer.groupPublicKey, msg);
    expect(valid).toBe(true);
  });

  it('different signer subset (participants 1 and 3) also produces valid signature', () => {
    const msg = te.encode('Different signer set');
    const dealer = dealerKeyGen(3, 2);

    const noncesMap = new Map<number, ReturnType<typeof generateCommitment>['nonces']>();
    const commitmentsMap = new Map<number, ReturnType<typeof generateCommitment>['commitment']>();
    for (const p of dealer.participants) {
      const { nonces, commitment } = generateCommitment(p.index);
      noncesMap.set(p.index, nonces);
      commitmentsMap.set(p.index, commitment);
    }

    const signers = [1, 3];
    const signingIndices = signers.map(BigInt);
    const signingCommitments = signers.map(i => commitmentsMap.get(i)!);

    const partialSigs = signers.map(idx => {
      const p = dealer.participants.find(x => x.index === idx)!;
      return partialSign({
        participantIndex: idx,
        secretShare: p.secretShare,
        nonces: noncesMap.get(idx)!,
        commitment: commitmentsMap.get(idx)!,
        signingCommitments,
        groupPublicKey: dealer.groupPublicKey,
        message: msg,
        signingIndices,
      });
    });

    const aggSig = aggregate(partialSigs, signingCommitments, dealer.groupPublicKey, msg);
    expect(verifySignature(aggSig, dealer.groupPublicKey, msg)).toBe(true);
  });

  it('corrupted partial signature produces invalid aggregate', () => {
    const msg = te.encode('Corrupted sig test');
    const dealer = dealerKeyGen(3, 2);

    const noncesMap = new Map<number, ReturnType<typeof generateCommitment>['nonces']>();
    const commitmentsMap = new Map<number, ReturnType<typeof generateCommitment>['commitment']>();
    for (const p of dealer.participants) {
      const { nonces, commitment } = generateCommitment(p.index);
      noncesMap.set(p.index, nonces);
      commitmentsMap.set(p.index, commitment);
    }

    const signers = [1, 2];
    const signingIndices = signers.map(BigInt);
    const signingCommitments = signers.map(i => commitmentsMap.get(i)!);

    const partialSigs = signers.map(idx => {
      const p = dealer.participants.find(x => x.index === idx)!;
      return partialSign({
        participantIndex: idx,
        secretShare: p.secretShare,
        nonces: noncesMap.get(idx)!,
        commitment: commitmentsMap.get(idx)!,
        signingCommitments,
        groupPublicKey: dealer.groupPublicKey,
        message: msg,
        signingIndices,
      });
    });

    // Corrupt participant 1's partial sig by flipping a bit
    partialSigs[0] = { ...partialSigs[0], z: partialSigs[0].z ^ 1n };

    const aggSig = aggregate(partialSigs, signingCommitments, dealer.groupPublicKey, msg);
    // Corrupted partial sig → invalid aggregate → verify returns false
    expect(verifySignature(aggSig, dealer.groupPublicKey, msg)).toBe(false);
  });

  it('aggregate output does not contain a reconstructed secret key property', () => {
    // Structural invariant: the AggSig object has no field that represents the full private key
    const msg = te.encode('invariant test');
    const dealer = dealerKeyGen(3, 2);

    const nonces1 = generateCommitment(1);
    const nonces2 = generateCommitment(2);
    const signingCommitments = [nonces1.commitment, nonces2.commitment];
    const signingIndices = [1n, 2n];

    const p1 = dealer.participants[0];
    const p2 = dealer.participants[1];

    const ps1 = partialSign({ participantIndex: 1, secretShare: p1.secretShare, nonces: nonces1.nonces, commitment: nonces1.commitment, signingCommitments, groupPublicKey: dealer.groupPublicKey, message: msg, signingIndices });
    const ps2 = partialSign({ participantIndex: 2, secretShare: p2.secretShare, nonces: nonces2.nonces, commitment: nonces2.commitment, signingCommitments, groupPublicKey: dealer.groupPublicKey, message: msg, signingIndices });

    const aggSig = aggregate([ps1, ps2], signingCommitments, dealer.groupPublicKey, msg);

    // The AggSig only has R, z, signature — not a private key
    const keys = Object.keys(aggSig);
    expect(keys).not.toContain('privateKey');
    expect(keys).not.toContain('secretKey');
    expect(keys).not.toContain('reconstructed');
    expect(keys).toContain('signature');
    expect(aggSig.signature.length).toBe(64);
  });
});
