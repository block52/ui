import { useCallback, useEffect, useState } from "react";
import { useCosmosApi } from "../../context/CosmosApiContext";

// Cosmos REST response shapes (snake_case over the wire). Only the fields the
// /nodes portal reads are declared.
interface NodeInfoResponse {
    default_node_info: { network: string; version: string };
    application_version: { version: string };
}
interface LatestBlockResponse {
    block: { header: { height: string } };
}
interface StakingParamsResponse {
    params: { bond_denom: string; unbonding_time: string; max_validators: number };
}
interface SlashingParamsResponse {
    params: {
        signed_blocks_window: string;
        min_signed_per_window: string;
        downtime_jail_duration: string;
        slash_fraction_downtime: string;
        slash_fraction_double_sign: string;
    };
}
interface PokerParamsResponse {
    params: { min_validator_bond: string };
}
interface ValidatorsResponse {
    validators: Array<{
        operator_address: string;
        jailed: boolean;
        tokens: string;
        description: { moniker: string };
        commission: { commission_rates: { rate: string } };
    }>;
}

export interface BondedValidator {
    moniker: string;
    operatorAddress: string;
    tokens: bigint;
    jailed: boolean;
    commissionRate: string;
}

/** One live snapshot of the chain facts the portal shows. Nothing is defaulted: a missing field is an error. */
export interface ChainOverview {
    chainId: string;
    appVersion: string;
    cometVersion: string;
    latestHeight: number;
    bondDenom: string;
    unbondingTime: string;
    maxValidators: number;
    minValidatorBond: bigint;
    slashing: SlashingParamsResponse["params"];
    validators: BondedValidator[];
}

export interface UseChainOverviewReturn {
    overview: ChainOverview | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

/**
 * useChainOverview: reads the network facts for the /nodes portal from the current
 * network's REST API (node info, height, staking/slashing/poker params, and the
 * bonded validator set).
 */
export const useChainOverview = (): UseChainOverviewReturn => {
    const api = useCosmosApi();
    const [overview, setOverview] = useState<ChainOverview | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [nodeInfo, latest, staking, slashing, poker, bonded] = await Promise.all([
                api.getNodeInfo() as Promise<NodeInfoResponse>,
                api.getLatestBlock() as Promise<LatestBlockResponse>,
                api.getStakingParams() as Promise<StakingParamsResponse>,
                api.getSlashingParams() as Promise<SlashingParamsResponse>,
                api.getPokerParams() as Promise<PokerParamsResponse>,
                api.getValidatorsByStatus("BOND_STATUS_BONDED") as Promise<ValidatorsResponse>
            ]);
            setOverview({
                chainId: nodeInfo.default_node_info.network,
                appVersion: nodeInfo.application_version.version,
                cometVersion: nodeInfo.default_node_info.version,
                latestHeight: Number(latest.block.header.height),
                bondDenom: staking.params.bond_denom,
                unbondingTime: staking.params.unbonding_time,
                maxValidators: staking.params.max_validators,
                minValidatorBond: BigInt(poker.params.min_validator_bond),
                slashing: slashing.params,
                validators: bonded.validators.map(v => ({
                    moniker: v.description.moniker,
                    operatorAddress: v.operator_address,
                    tokens: BigInt(v.tokens),
                    jailed: v.jailed,
                    commissionRate: v.commission.commission_rates.rate
                }))
            });
        } catch (err) {
            console.error("[useChainOverview] Failed to load chain overview:", err);
            setError(err instanceof Error ? err.message : "Failed to load chain overview");
        } finally {
            setIsLoading(false);
        }
    }, [api]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { overview, isLoading, error, refresh };
};
