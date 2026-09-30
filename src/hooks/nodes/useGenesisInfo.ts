import { useEffect, useState } from "react";
import { GENESIS_PATH, GENESIS_SHA256 } from "../../constants/chainNetwork";

interface GenesisFile {
    chain_id: string;
    genesis_time: string;
    initial_height: string;
    app_state: {
        genutil: { gen_txs: Array<{ body: { messages: Array<{ description: { moniker: string }; validator_address: string; value: { amount: string; denom: string } }> } }> };
    };
}

export interface GenesisValidator {
    moniker: string;
    validatorAddress: string;
    selfBond: string;
}

export interface GenesisInfo {
    chainId: string;
    genesisTime: string;
    initialHeight: string;
    sha256: string;
    /** The served file hashes to the pinned GENESIS_SHA256. */
    verified: boolean;
    genesisValidators: GenesisValidator[];
}

const toHex = (buf: ArrayBuffer): string => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");

/**
 * useGenesisInfo: fetches the genesis file the UI serves, hashes the exact bytes
 * in the browser (SHA-256) and checks the result against the pinned hash, so the
 * download link is verifiably the chain's genesis.
 */
export const useGenesisInfo = (): { genesis: GenesisInfo | null; error: string | null } => {
    const [genesis, setGenesis] = useState<GenesisInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                // Served by the UI itself (public/genesis.json), not a chain endpoint:
                // a static asset, so there is no HTTPClient API class for it.
                const res = await fetch(GENESIS_PATH);
                if (!res.ok) throw new Error(`genesis.json: HTTP ${res.status}`);
                const bytes = await res.arrayBuffer();
                const sha256 = toHex(await crypto.subtle.digest("SHA-256", bytes));
                const file = JSON.parse(new TextDecoder().decode(bytes)) as GenesisFile;
                setGenesis({
                    chainId: file.chain_id,
                    genesisTime: file.genesis_time,
                    initialHeight: file.initial_height,
                    sha256,
                    verified: sha256 === GENESIS_SHA256,
                    genesisValidators: file.app_state.genutil.gen_txs.flatMap(tx =>
                        tx.body.messages.map(m => ({
                            moniker: m.description.moniker,
                            validatorAddress: m.validator_address,
                            selfBond: `${m.value.amount}${m.value.denom}`
                        }))
                    )
                });
            } catch (err) {
                console.error("[useGenesisInfo] Failed to load genesis:", err);
                setError(err instanceof Error ? err.message : "Failed to load genesis");
            }
        };
        load();
    }, []);

    return { genesis, error };
};
