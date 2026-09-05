import { useState, useEffect } from "react";
// Import Long from the SDK's OWN nested copy (long@5) so the type is identical to
// what ValidatorBond.bondedUsdc expects. The top-level `long` is a DIFFERENT,
// major-incompatible install (long@4, pulled by other deps) whose Long type is
// not assignable to the SDK's. Because top-level is occupied by long@4, the
// package manager cannot hoist the SDK's long@5, so this nested path is stable.
import Long from "@block52/poker-vm-sdk/node_modules/long";
import { ValidatorBond } from "@block52/poker-vm-sdk";
import { NETWORK_PRESETS } from "../../context/NetworkContext";
import { useCosmosApiFactory } from "../../context/CosmosApiContext";

/**
 * useValidatorBonds — reads each validator's bonded USDC (the weight used to split
 * the SNG protocol fee, poker-vm#2592) from the standard Cosmos staking module.
 *
 * No custom poker-module query is needed: the chain's bond denom is USDC
 * (`sdk.DefaultBondDenom = "usdc"`, pokerchain #289/#291), so a validator's
 * staking `tokens` field IS its bonded USDC in micro-units, 1:1 — the exact
 * quantity `distributeProtocolFee` splits by (`GetBondedTokens()`). We map the
 * standard `/cosmos/staking/v1beta1/validators` response onto the SDK
 * `ValidatorBond` shape (Commandment #1): `operator_address` → `validator`,
 * `tokens` → `bondedUsdc`.
 *
 * We fabricate NO numbers (Commandment #7): if no node responds, the list is
 * empty and the panel renders its empty state.
 *
 * NOTE: this is bonded USDC (the split WEIGHT), not accrued fee earnings over
 * time. Protocol fees are paid-and-emitted per distribution with no per-validator
 * accumulator state, so a running-earnings total is a separate concern (would
 * need new state or event indexing) — tracked outside this hook.
 */
export interface ValidatorBondsReturn {
    bonds: ValidatorBond[];
    /** True once bonded-USDC data has been fetched from a staking endpoint. */
    hasQuery: boolean;
    isLoading: boolean;
    error: string | null;
}

// Localhost is filtered out for the production explorer view, matching NodesPage.
const productionNodes = NETWORK_PRESETS.filter(n => n.name !== "Localhost");

export const useValidatorBonds = (): ValidatorBondsReturn => {
    const cosmosApiFactory = useCosmosApiFactory();
    const [bonds, setBonds] = useState<ValidatorBond[]>([]);
    const [hasQuery, setHasQuery] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchBonds = async () => {
            setIsLoading(true);
            setError(null);

            for (const node of productionNodes) {
                try {
                    const data = (await cosmosApiFactory(node.rest).getValidatorsByStatus(
                        "BOND_STATUS_BONDED",
                        AbortSignal.timeout(10000)
                    )) as { validators?: { operator_address?: string; tokens?: string }[] };

                    const mapped: ValidatorBond[] = (data.validators || [])
                        .filter(v => v.operator_address && v.tokens)
                        .map(v => ({
                            validator: v.operator_address as string,
                            bondedUsdc: Long.fromString(v.tokens as string)
                        }));

                    if (!cancelled) {
                        setBonds(mapped);
                        setHasQuery(true);
                        setIsLoading(false);
                    }
                    return;
                } catch (err) {
                    // Try the next node; only surface an error if all fail.
                    console.error(`Failed to fetch validator bonds from ${node.rest}:`, err);
                }
            }

            if (!cancelled) {
                setError("Could not reach any staking endpoint");
                setIsLoading(false);
            }
        };

        fetchBonds();
        return () => {
            cancelled = true;
        };
    }, [cosmosApiFactory]);

    return { bonds, hasQuery, isLoading, error };
};
