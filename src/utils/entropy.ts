/**
 * Shared client entropy generation.
 *
 * Used by the deal-entropy modal (user-facing "System Entropy") AND the
 * new-hand player seed (poker-vm#2450 Layer 2). Keeping one generator avoids
 * two copies of the CSPRNG drifting apart.
 */

/**
 * 32-byte (256-bit) system entropy as "0x"+hex, via webcrypto.
 */
export function generateSystemEntropy(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return "0x" + Array.from(array, byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * The system entropy as BARE 32-byte hex (no 0x prefix) — the exact format the
 * chain's ParsePlayerSeed expects for a new-hand "seed=<hex>" (poker-vm#2450).
 * The acting player carries this on new-hand; the chain folds it into the
 * per-hand VRF (deck = player seed ⊕ proposer VRF), so the client never picks
 * the deck (a client deck is what forked the chain, poker-vm#2418).
 */
export function generatePlayerSeedHex(): string {
    return generateSystemEntropy().slice(2);
}
