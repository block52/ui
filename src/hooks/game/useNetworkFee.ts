import { useEffect, useState } from "react";
import { useNetwork } from "../../context/NetworkContext";
import { getCosmosClient } from "../../utils/cosmos/client";
import { DEFAULT_NETWORK_FEE_MICRO } from "../../utils/buyInUtils";
import { getNetworkFeePerEntryCached, type NetworkFeeClient } from "../../utils/networkFee";

export interface UseNetworkFeeResult {
    /** The flat network fee per Sit & Go seat / tournament entry, micro-USDC. 0.10 USDC until the chain answers. */
    networkFeeMicro: bigint;
    /** True until the first read for the current network settles. */
    isLoading: boolean;
    /** True when the value is the 0.10 USDC default because the chain could not be read (logged). */
    isFallback: boolean;
}

/**
 * The chain's flat network fee per Sit & Go seat and tournament entry
 * (x/poker param `network_fee_per_entry`, governance-set; block52/pokerchain#476),
 * read through the SDK's `getNetworkFeePerEntry()` and shared by every caller
 * via a cache keyed by the network's REST endpoint.
 *
 * While loading, on a failed read, or on an SDK without the method, it reports
 * DEFAULT_NETWORK_FEE_MICRO (0.10 USDC); a failure is logged and flagged with
 * `isFallback`. 0 is a valid governance value (no fee).
 */
export const useNetworkFee = (): UseNetworkFeeResult => {
    const { currentNetwork } = useNetwork();
    const [networkFeeMicro, setNetworkFeeMicro] = useState<bigint>(DEFAULT_NETWORK_FEE_MICRO);
    const [isLoading, setIsLoading] = useState(true);
    const [isFallback, setIsFallback] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        const getClient = (): NetworkFeeClient | null => getCosmosClient(currentNetwork);
        getNetworkFeePerEntryCached(currentNetwork.rest, getClient).then(reading => {
            if (cancelled) return;
            setNetworkFeeMicro(reading.feeMicro);
            setIsFallback(reading.source === "fallback");
            setIsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [currentNetwork]);

    return { networkFeeMicro, isLoading, isFallback };
};
