// FROST types — RFC 9591 (FROST-Ed25519-SHA512-v1, simplified with trusted dealer)

export interface ParticipantShare {
  index: number;           // participant index (1-based)
  secretShare: bigint;     // s_i in Z_l — keep secret
  publicShare: Uint8Array; // S_i = s_i * G — 32-byte compressed point
}

export interface DealerResult {
  groupPublicKey: Uint8Array;  // Y = s * G (32 bytes, compressed Ed25519 point)
  participants: ParticipantShare[];
  n: number;
  k: number;
}

export interface Nonces {
  d: bigint; // hiding nonce
  e: bigint; // binding nonce
}

export interface Commitment {
  participantIndex: number;
  D: Uint8Array; // D_i = d_i * G (32 bytes)
  E: Uint8Array; // E_i = e_i * G (32 bytes)
}

export interface PartialSig {
  participantIndex: number;
  z: bigint; // z_i = d_i + e_i*ρ_i + λ_i * s_i * c
}

export interface AggSig {
  R: Uint8Array;   // group commitment (32 bytes, compressed point)
  z: bigint;       // aggregate response scalar
  signature: Uint8Array; // R || z_bytes (64 bytes) — valid Ed25519 signature
}
