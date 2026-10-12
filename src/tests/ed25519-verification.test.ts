import { describe, expect, it } from 'vitest';
import { bytesToScalar } from '../frost/field.js';
import { verifySignature } from '../frost/verify.js';

const hex = (text: string): Uint8Array => Uint8Array.from(text.match(/../g)!, byte => parseInt(byte, 16));
// RFC 8032 §7.1, TEST 1: pure Ed25519, an empty message (not Ed25519ph).
const publicKey = hex('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
const signature = hex(
  'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155' +
  '5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
);
const frame = (bytes: Uint8Array) => ({ R: bytes.slice(0, 32), z: bytesToScalar(bytes.slice(32)), signature: bytes });

describe('Ed25519 verifier migration controls', () => {
  it('accepts the published pure-Ed25519 signature, with independent WebCrypto agreement', async () => {
    const message = new Uint8Array(0);
    expect(verifySignature(frame(signature), publicKey, message)).toBe(true);
    const key = await crypto.subtle.importKey('raw', new Uint8Array(publicKey).buffer, 'Ed25519', false, ['verify']);
    expect(await crypto.subtle.verify('Ed25519', key, new Uint8Array(signature).buffer, message.buffer)).toBe(true);

    const corrupted = Uint8Array.from(signature);
    corrupted[32] ^= 1;
    expect(verifySignature(frame(corrupted), publicKey, message)).toBe(false);
    expect(await crypto.subtle.verify('Ed25519', key, corrupted.buffer, message.buffer)).toBe(false);
    expect(verifySignature(frame(signature), publicKey, Uint8Array.of(1))).toBe(false);
    expect(await crypto.subtle.verify('Ed25519', key, new Uint8Array(signature).buffer, Uint8Array.of(1).buffer)).toBe(false);
  });

  it('fails closed on malformed signature and public-key lengths', () => {
    for (const length of [0, 63, 65]) {
      expect(verifySignature(frame(new Uint8Array(length)), publicKey, new Uint8Array(0))).toBe(false);
    }
    for (const length of [0, 31, 33]) {
      expect(verifySignature(frame(signature), new Uint8Array(length), new Uint8Array(0))).toBe(false);
    }
  });
});
