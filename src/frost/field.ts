// Arithmetic in Z_l — the prime scalar field of Ed25519.
// l = 2^252 + 27742317777372353535851937790883648493

export const L = 7237005577332262213973186563042994240857116359379907606001950938285454250989n;

export function fieldAdd(a: bigint, b: bigint): bigint {
  return ((a + b) % L + L) % L;
}

export function fieldSub(a: bigint, b: bigint): bigint {
  return ((a - b) % L + L) % L;
}

export function fieldMul(a: bigint, b: bigint): bigint {
  return ((a * b) % L + L) % L;
}

export function fieldNeg(a: bigint): bigint {
  return a === 0n ? 0n : L - (a % L);
}

export function fieldInv(a: bigint): bigint {
  // Fermat: a^{l-2} mod l
  return fieldPow(((a % L) + L) % L, L - 2n);
}

function fieldPow(base: bigint, exp: bigint): bigint {
  let result = 1n;
  base = ((base % L) + L) % L;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % L;
    base = (base * base) % L;
    exp >>= 1n;
  }
  return result;
}

// Encode scalar to 32-byte little-endian
export function scalarToBytes(s: bigint): Uint8Array {
  const n = ((s % L) + L) % L;
  const bytes = new Uint8Array(32);
  let rem = n;
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(rem & 0xffn);
    rem >>= 8n;
  }
  return bytes;
}

// Decode 32-byte or 64-byte little-endian to scalar (mod l)
export function bytesToScalar(bytes: Uint8Array): bigint {
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    n = (n << 8n) | BigInt(bytes[i]);
  }
  return n % L;
}

// Generate a random scalar in Z_l using 64 bytes of entropy (negligible bias)
export function randomScalar(): bigint {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return bytesToScalar(bytes);
}

// Lagrange coefficient L_i(0) for index x_i given all signing indices.
// L_i(0) = product((0 - x_j)/(x_i - x_j)) for j in signingIndices, j != x_i
export function lagrangeCoeff(x_i: bigint, signingIndices: bigint[]): bigint {
  let num = 1n;
  let den = 1n;
  for (const x_j of signingIndices) {
    if (x_j === x_i) continue;
    num = fieldMul(num, fieldNeg(x_j));           // 0 - x_j
    den = fieldMul(den, fieldSub(x_i, x_j));      // x_i - x_j
  }
  return fieldMul(num, fieldInv(den));
}

// Shamir split of a scalar secret in Z_l
export function scalarShamirSplit(secret: bigint, n: number, k: number): bigint[] {
  const coeffs: bigint[] = [((secret % L) + L) % L];
  for (let i = 1; i < k; i++) coeffs.push(randomScalar());

  const shares: bigint[] = [];
  for (let xi = 1n; xi <= BigInt(n); xi++) {
    let y = 0n;
    for (let c = k - 1; c >= 0; c--) {
      y = fieldAdd(fieldMul(y, xi), coeffs[c]);
    }
    shares.push(y);
  }
  return shares;
}
