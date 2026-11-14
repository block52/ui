import { hasContent } from "./guards";

/**
 * A validator's bonded USDC: the weight the protocol fee is split by (poker-vm#2592).
 *
 * This is a UI type, not an SDK one. The chain no longer has a ValidatorBond message
 * (it was removed when the split moved to native Cosmos staking, pokerchain#335), and
 * SDK 1.25.0 stopped exporting the leftover (poker-vm#2595). The bond denom is USDC,
 * so a validator's staking `tokens` IS its bonded USDC, 1:1.
 */
export interface ValidatorBond {
    /** The validator's operator address (`b52valoper1...`). */
    validator: string;
    /** Bonded USDC in micro-USDC (6 decimals), as a decimal string. */
    bondedUsdc: string;
}

/** The two fields of a `/cosmos/staking/v1beta1/validators` entry that matter here. */
export interface StakingValidatorEntry {
    operator_address?: string;
    tokens?: string;
}

/**
 * Maps a staking validators reply onto bonds. Entries without an operator address or
 * without tokens are dropped, and nothing is filled in for them (Commandment 7).
 */
export const toValidatorBonds = (validators: StakingValidatorEntry[] | undefined): ValidatorBond[] =>
    (validators ?? []).flatMap(v =>
        hasContent(v.operator_address) && hasContent(v.tokens) ? [{ validator: v.operator_address, bondedUsdc: v.tokens }] : []
    );
