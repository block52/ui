import { useEffect, useState } from "react";
import { useCosmosApi } from "../../context/CosmosApiContext";
import { SNAPSHOT_INTERVAL } from "../../constants/chainNetwork";
import { base64ToHex, stateSyncTrustHeight } from "../../utils/nodePortal";

interface BlockResponse {
    block_id: { hash: string };
}

/**
 * useStateSyncTrust: a live [statesync] trust point for a new node, i.e. a height
 * just below the latest snapshot and that block's hash (hex), read from the chain.
 */
export const useStateSyncTrust = (latestHeight: number | null): { trustHeight: number | null; trustHash: string | null; error: string | null } => {
    const api = useCosmosApi();
    const [trustHeight, setTrustHeight] = useState<number | null>(null);
    const [trustHash, setTrustHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (latestHeight === null) return;
        const height = stateSyncTrustHeight(latestHeight, SNAPSHOT_INTERVAL);
        const load = async () => {
            try {
                const block = (await api.getBlockByHeight(height)) as BlockResponse;
                setTrustHeight(height);
                setTrustHash(base64ToHex(block.block_id.hash));
                setError(null);
            } catch (err) {
                console.error("[useStateSyncTrust] Failed to fetch trust block:", err);
                setError(err instanceof Error ? err.message : "Failed to fetch trust block");
            }
        };
        load();
    }, [api, latestHeight]);

    return { trustHeight, trustHash, error };
};
