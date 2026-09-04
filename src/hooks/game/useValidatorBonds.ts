import { useMemo } from "react";
import { ValidatorBond } from "@block52/poker-vm-sdk";

/**
 * useValidatorBonds — reads each validator's bonded USDC (the weight used to split
 * the SNG protocol fee, poker-vm#2592) from the poker module.
 *
 * ⚠️ BACKEND QUERY MISSING (poker-vm#2592):
 * The `ValidatorBond` state exists in the pokerchain poker keeper
 * (`x/poker/keeper/validator_bond.go`) but is NOT exposed via a query RPC / REST
 * endpoint — there is no `rpc ValidatorBonds(...)` in
 * `proto/pokerchain/poker/v1/query.proto`, and no matching method on `CosmosApi`.
 *
 * Until that read endpoint is added and regenerated into the SDK, this hook has
 * nothing to fetch and returns an empty list. Once the endpoint lands, wire it
 * here (add `getValidatorBonds` to `CosmosApi`, decode via the SDK `ValidatorBond`
 * type) — the consuming `ValidatorEarningsPanel` already accepts `ValidatorBond[]`
 * and needs no change.
 *
 * We deliberately fabricate NO bonded-USDC/earnings numbers (Commandment #7) —
 * an empty list renders the panel's "coming soon" state rather than fake weights.
 */
export interface ValidatorBondsReturn {
    bonds: ValidatorBond[];
    /** True once a real backend query exists and is wired here. Currently always false. */
    hasQuery: boolean;
    isLoading: boolean;
    error: string | null;
}

export const useValidatorBonds = (): ValidatorBondsReturn => {
    // TODO(poker-vm#2592): replace with a real fetch once the poker module exposes
    // a ValidatorBonds query (see block comment above). Keep the ValidatorBond SDK
    // type as the single source of truth for the returned shape (Commandment #1).
    return useMemo(
        () => ({
            bonds: [],
            hasQuery: false,
            isLoading: false,
            error: null
        }),
        []
    );
};
