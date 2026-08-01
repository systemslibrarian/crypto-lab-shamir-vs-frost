# Threshold Lab — Shamir vs FROST

## What It Is

Threshold Lab is a side-by-side interactive browser demo comparing Shamir's Secret Sharing (SSS) and FROST threshold signatures (FROST-Ed25519-SHA512, following RFC 9591 but not a conformant implementation of it — see [Deviations from RFC 9591](#deviations-from-rfc-9591)). Shamir SSS splits a secret into _n_ shares using polynomial interpolation over GF(256), requiring any _k_ shares to reconstruct the original — but reconstruction assembles the full secret in memory before it can be used. FROST (Flexible Round-Optimized Schnorr Threshold) distributes an Ed25519 signing key across _n_ participants so that any _k_ can co-sign a message in two rounds _without the private key ever existing on any single machine_. The demo uses real cryptographic primitives: hand-rolled GF(256) Shamir, real two-round FROST signing over the Ed25519 scalar field via `@noble/curves`, and SubtleCrypto HMAC-SHA256 — no simulation, no backend. The FROST signing is real arithmetic producing a real Ed25519 signature, but it is a teaching implementation with documented simplifications, not a drop-in RFC 9591 library.

The demo is built to teach both mechanisms, not just assert them:

- **Shamir "why exactly _k_?" interpolation view.** As you select shares, a live view fans out infinitely many degree-(_k_−1) curves through _k_−1 points (the secret at _x_=0 could be anything → perfect secrecy), then snaps to the single curve that fits once you reach _k_ points (the secret is pinned down). The curves are real polynomials evaluated over the reals — an honest illustration of the Lagrange-interpolation theorem that governs the GF(256) implementation, kept separate from the actual share bytes shown alongside.
- **FROST aggregation view.** On Sign, each selected participant emits a partial-signature chip _z_i_ computed from only their own share, and a running sum accumulates them into the single 64-byte aggregate — making "_k_ partials add up, no share ever meets another, the key is never assembled" visible rather than a black-box "valid" badge.
- **Inline glossary.** First uses of _threshold (k of n)_, _nonce_, _commitment_, _hiding nonce_, _Lagrange coefficient_, _binding factor_, _partial signature_, and _DKG_ carry dotted-underline tooltips (hover/focus/tap) so the deeper layers don't assume vocabulary the top-level story hasn't introduced.
- **Progressive disclosure.** The interactive head-to-head comes first; the full seven-dimension comparison table follows it, collapsed to the three load-bearing rows with a "show all dimensions" expander — the summary you read _after_ building intuition, not the opening wall of jargon.

## When to Use It

- **Seed phrase / key escrow backup (use Shamir):** When you need to recover a static secret — a BIP-39 mnemonic, an encryption key, a root credential — and recovery is the goal, not ongoing signing. Shamir is simple and offline-friendly; the reconstruction window is the accepted trade-off.
- **Threshold signing without key assembly (use FROST):** When multiple parties must authorize transactions or signatures and the private key must never exist on any single machine. Ideal for hot wallets, distributed signing services, and HSM replacement.
- **Teaching the distinction between "split and reassemble" vs "compute without assembling" (use this demo):** Shamir and FROST are frequently conflated; this side-by-side walkthrough makes the architectural difference visceral.
- **Risk scenario modeling:** Use the interactive compromise cards to reason about what an adversary gains if a share is stolen before vs during reconstruction, or if a FROST participant is compromised mid-signing.
- **Do NOT use Shamir for ongoing signing:** If you need to sign frequently, the repeated reconstruction window is an unacceptable attack surface. Use FROST or a hardware key instead.

## Deviations from RFC 9591

The FROST panel runs genuine two-round threshold Schnorr arithmetic and emits a signature that
verifies as a standard Ed25519 signature. It is nonetheless a **teaching implementation, not a
conformant RFC 9591 (FROST-Ed25519-SHA512-v1) one.** Two documented simplifications:

- **The binding factor is simplified.** `src/frost/round2.ts` computes
  `ρ_i = H(i ‖ encoded_commitments ‖ message) mod l` with a bare SHA-512. RFC 9591 derives
  binding factors through its `H1` domain-separated hash, which prefixes a ciphersuite
  ContextString and hashes the message digest rather than the raw message. The code comment says
  so; this README previously did not. Binding factors from this demo will not match a conformant
  implementation, so it does not interoperate with one.
- **Keys come from a trusted dealer, not a DKG.** `src/frost/keygen.ts` generates the group secret
  in one place and splits it, so the key does exist on one machine at setup time. The
  *never-reconstructed* property the demo teaches holds for **signing**, which is the point being
  made — but a production deployment would use distributed key generation so no single machine
  ever holds the whole key at any moment.

Both are deliberate: they keep the mechanism legible. Neither is safe to carry into production
code. Use a maintained RFC 9591 implementation for anything real.

## Live Demo

[https://systemslibrarian.github.io/crypto-lab-shamir-vs-frost/](https://systemslibrarian.github.io/crypto-lab-shamir-vs-frost/)

Walk through both protocols side-by-side using the same logical key material. On the Shamir panel, set _n_ (total shares) and _k_ (threshold), split a secret, then select shares one at a time and watch the interpolation view go from a fan of undetermined curves (below _k_) to a single locked curve that reveals the secret (at _k_) — the "Private key in memory" badge flips to amber the moment the secret is assembled. On the FROST panel, distribute shares, generate Round 1 commitments, select _k_ participants, and sign — the partial signatures animate into one aggregate while the "Key never reconstructed" badge stays green throughout. Three interactive risk scenarios show what an attacker gains at each stage of each protocol.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-shamir-vs-frost
cd crypto-lab-shamir-vs-frost
npm install
npm run dev
```

To run the test suite (GF256 arithmetic, Shamir round-trips, FROST signing and verification):

```bash
npm test
```

No environment variables required. Everything runs in the browser with no backend.

## Part of the Crypto-Lab Suite

One of 170+ live browser demos at [crypto-lab.systemslibrarian.dev](https://crypto-lab.systemslibrarian.dev/) — spanning Atbash (600 BCE) through NIST FIPS 203/204/205 (2024).

---

*"Whether you eat or drink, or whatever you do, do all to the glory of God." — 1 Corinthians 10:31*
