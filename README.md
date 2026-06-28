# Threshold Lab — Shamir vs FROST

## What It Is

Threshold Lab is a side-by-side interactive browser demo comparing Shamir's Secret Sharing (SSS) and FROST threshold signatures (RFC 9591). Shamir SSS splits a secret into _n_ shares using polynomial interpolation over GF(256), requiring any _k_ shares to reconstruct the original — but reconstruction assembles the full secret in memory before it can be used. FROST (Flexible Round-Optimized Schnorr Threshold) distributes an Ed25519 signing key across _n_ participants so that any _k_ can co-sign a message in two rounds _without the private key ever existing on any single machine_. The demo uses real cryptographic primitives: hand-rolled GF(256) Shamir, full FROST signing over the Ed25519 scalar field via `@noble/curves`, and SubtleCrypto HMAC-SHA256 — no simulation, no backend.

## When to Use It

- **Seed phrase / key escrow backup (use Shamir):** When you need to recover a static secret — a BIP-39 mnemonic, an encryption key, a root credential — and recovery is the goal, not ongoing signing. Shamir is simple and offline-friendly; the reconstruction window is the accepted trade-off.
- **Threshold signing without key assembly (use FROST):** When multiple parties must authorize transactions or signatures and the private key must never exist on any single machine. Ideal for hot wallets, distributed signing services, and HSM replacement.
- **Teaching the distinction between "split and reassemble" vs "compute without assembling" (use this demo):** Shamir and FROST are frequently conflated; this side-by-side walkthrough makes the architectural difference visceral.
- **Risk scenario modeling:** Use the interactive compromise cards to reason about what an adversary gains if a share is stolen before vs during reconstruction, or if a FROST participant is compromised mid-signing.
- **Do NOT use Shamir for ongoing signing:** If you need to sign frequently, the repeated reconstruction window is an unacceptable attack surface. Use FROST or a hardware key instead.

## Live Demo

[https://crypto-lab.systemslibrarian.dev/crypto-lab-shamir-vs-frost/](https://crypto-lab.systemslibrarian.dev/crypto-lab-shamir-vs-frost/)

Walk through both protocols side-by-side using the same logical key material. On the Shamir panel, set _n_ (total shares) and _k_ (threshold), split a secret, select _k_ shares to reconstruct, and sign a message — watching the "Private key in memory" badge flip to amber the moment the secret is assembled. On the FROST panel, distribute shares, generate Round 1 commitments, select _k_ participants, and sign — the "Key never reconstructed" badge stays green throughout. Three interactive risk scenarios show what an attacker gains at each stage of each protocol.

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

One of 60+ live browser demos at [crypto-lab.systemslibrarian.dev](https://crypto-lab.systemslibrarian.dev/) — spanning Atbash (600 BCE) through NIST FIPS 203/204/205 (2024).

---

*"Whether you eat or drink, or whatever you do, do all to the glory of God." — 1 Corinthians 10:31*
