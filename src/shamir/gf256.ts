// GF(256) arithmetic — irreducible polynomial x^8 + x^4 + x^3 + x + 1 (AES, 0x11b)
// Log/antilog table construction with primitive element 0x03.

const LOG = new Uint8Array(256);
const EXP = new Uint8Array(512); // 512 entries so we can avoid mod 255 branches

(function buildTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    // Multiply by 3 (= x+1), the primitive element for GF(256) with polynomial 0x11b.
    // x*3 = x*(x+1) = x*x + x*1 = x_times_x XOR x, where x_times_x reduces mod 0x1b
    // if bit 7 was set in x.
    x = (((x << 1) ^ (x & 0x80 ? 0x1b : 0)) ^ x) & 0xff;
  }
  EXP[255] = EXP[0]; // 3^255 == 1; wrap for convenience
  for (let i = 256; i < 512; i++) EXP[i] = EXP[i - 255];
  // LOG[0] is undefined (0 has no log); leave initialized to 0
})();

export function gfAdd(a: number, b: number): number {
  return (a ^ b) & 0xff;
}

export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a] + LOG[b]) % 255];
}

export function gfInv(a: number): number {
  if (a === 0) throw new Error('GF(256): inverse of 0 undefined');
  return EXP[255 - LOG[a]];
}

export function gfDiv(a: number, b: number): number {
  if (b === 0) throw new Error('GF(256): division by 0');
  if (a === 0) return 0;
  return EXP[(LOG[a] - LOG[b] + 255) % 255];
}

// Evaluate polynomial at x using Horner's method.
// coeffs[0] = constant term (secret byte), coeffs[i] = coefficient of x^i.
export function gfPolyEval(coeffs: Uint8Array, x: number): number {
  let y = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    y = gfAdd(gfMul(y, x), coeffs[i]);
  }
  return y;
}
