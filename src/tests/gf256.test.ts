import { describe, it, expect } from 'vitest';
import { gfAdd, gfMul, gfInv, gfDiv } from '../shamir/gf256.js';

describe('GF(256) arithmetic — irreducible polynomial 0x11b', () => {
  it('gfAdd is XOR', () => {
    expect(gfAdd(0x53, 0x53)).toBe(0x00);
    expect(gfAdd(0xff, 0xff)).toBe(0x00);
    expect(gfAdd(0x01, 0x00)).toBe(0x01);
    expect(gfAdd(0xab, 0xcd)).toBe(0xab ^ 0xcd);
  });

  it('gfMul by zero and one', () => {
    expect(gfMul(0x00, 0x42)).toBe(0x00);
    expect(gfMul(0x42, 0x00)).toBe(0x00);
    expect(gfMul(0x01, 0x42)).toBe(0x42);
    expect(gfMul(0x42, 0x01)).toBe(0x42);
  });

  it('gfMul reduction fires: 0x02 * 0x80 = 0x1b', () => {
    // 0x02 * 0x80 = 0x100, reduced by 0x11b: 0x100 XOR 0x11b = 0x01b = 0x1b
    expect(gfMul(0x02, 0x80)).toBe(0x1b);
  });

  it('gfMul commutativity', () => {
    expect(gfMul(0x53, 0x7a)).toBe(gfMul(0x7a, 0x53));
    expect(gfMul(0x0a, 0xf3)).toBe(gfMul(0xf3, 0x0a));
  });

  it('gfMul associativity', () => {
    const a = 0x05, b = 0x07, c = 0x09;
    expect(gfMul(gfMul(a, b), c)).toBe(gfMul(a, gfMul(b, c)));
  });

  it('gfInv: a * inv(a) == 1 for various a', () => {
    for (const a of [1, 2, 3, 7, 0x53, 0xca, 0xff]) {
      expect(gfMul(a, gfInv(a))).toBe(1);
    }
  });

  it('gfInv throws for 0', () => {
    expect(() => gfInv(0)).toThrow();
  });

  it('gfDiv(a, a) == 1 for nonzero a', () => {
    for (const a of [1, 5, 0x42, 0x80]) {
      expect(gfDiv(a, a)).toBe(1);
    }
  });

  it('gfDiv(0, a) == 0', () => {
    expect(gfDiv(0, 0x42)).toBe(0);
  });

  it('gfDiv throws for divisor 0', () => {
    expect(() => gfDiv(1, 0)).toThrow();
  });

  it('multiplicative group has order 255: a^255 == 1 for nonzero a', () => {
    let x = 0x03; // primitive element
    for (let i = 0; i < 254; i++) x = gfMul(x, 0x03);
    // After 255 multiplications: 0x03^255 == 1
    expect(gfMul(x, 0x03)).toBe(0x03); // i.e., 0x03^255 == 1 so 0x03^256 == 0x03
  });
});
