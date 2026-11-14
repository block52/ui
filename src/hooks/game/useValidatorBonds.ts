import { useState, useEffect } from "react";
import { toValidatorBonds, type StakingValidatorEntry, type ValidatorBond } from "../../utils/validatorBonds";
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
                    )) as { validators?: StakingValidatorEntry[] };

                    const mapped = toValidatorBonds(data.validators);

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
