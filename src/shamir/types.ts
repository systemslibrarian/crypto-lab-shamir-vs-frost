// A single participant's share of a secret.
// x: participant index (1-based, unique in [1..255])
// y: one GF(256) element per byte of the original secret
export interface Share {
  x: number;
  y: Uint8Array;
}
