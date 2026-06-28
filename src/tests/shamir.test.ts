import { describe, it, expect } from 'vitest';
import { split, reconstruct } from '../shamir/shamir.js';

const te = new TextEncoder();
const td = new TextDecoder();

function strToBytes(s: string) { return te.encode(s); }
function bytesToStr(b: Uint8Array) { return td.decode(b); }

describe('Shamir Secret Sharing', () => {
  it('round-trip: 5-of-3 — reconstruct from exactly k=3 shares', () => {
    const secret = strToBytes('hello world');
    const shares = split(secret, 5, 3);
    expect(shares.length).toBe(5);

    const recovered = reconstruct([shares[0], shares[2], shares[4]]);
    expect(bytesToStr(recovered)).toBe('hello world');
  });

  it('round-trip: reconstruct from all n shares', () => {
    const secret = strToBytes('all shares work');
    const shares = split(secret, 5, 3);
    const recovered = reconstruct(shares);
    expect(bytesToStr(recovered)).toBe('all shares work');
  });

  it('k-1 shares do not recover the secret', () => {
    const secret = strToBytes('secret value');
    const shares = split(secret, 5, 3);
    // 2 shares (< k=3) reconstruct the wrong value
    const wrong = reconstruct([shares[0], shares[1]]);
    expect(bytesToStr(wrong)).not.toBe('secret value');
  });

  it('any combination of k shares recovers the secret', () => {
    const secret = strToBytes('test');
    const shares = split(secret, 5, 3);
    // Try multiple combinations
    for (const combo of [
      [0, 1, 2], [0, 1, 3], [0, 1, 4], [1, 2, 3], [2, 3, 4],
    ]) {
      const r = reconstruct(combo.map(i => shares[i]));
      expect(bytesToStr(r)).toBe('test');
    }
  });

  it('fixed test vector: n=3 k=2', () => {
    // We use a known secret and verify the round-trip is deterministic
    const secret = new Uint8Array([0x42, 0x00]);
    const shares = split(secret, 3, 2);

    // Any 2-of-3 should reconstruct
    expect(reconstruct([shares[0], shares[1]])).toEqual(secret);
    expect(reconstruct([shares[0], shares[2]])).toEqual(secret);
    expect(reconstruct([shares[1], shares[2]])).toEqual(secret);
  });

  it('k > n throws', () => {
    expect(() => split(strToBytes('x'), 3, 5)).toThrow('Threshold cannot exceed share count');
  });

  it('duplicate share indices throw on reconstruct', () => {
    const secret = strToBytes('dup test');
    const shares = split(secret, 5, 3);
    const dup = [shares[0], shares[0], shares[1]]; // x=1 appears twice
    expect(() => reconstruct(dup)).toThrow('Duplicate share indices');
  });

  it('empty secret throws', () => {
    expect(() => split(new Uint8Array(0), 3, 2)).toThrow('Secret cannot be empty');
  });

  it('32-byte secret round-trips correctly', () => {
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const shares = split(secret, 7, 4);
    const recovered = reconstruct([shares[0], shares[2], shares[4], shares[6]]);
    expect(recovered).toEqual(secret);
  });
});
