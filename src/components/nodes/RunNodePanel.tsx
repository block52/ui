import { FC } from "react";
import { ChainOverview } from "../../hooks/nodes/useChainOverview";
import { useStateSyncTrust } from "../../hooks/nodes/useStateSyncTrust";
import { SEED_NODES, SNAPSHOT_INTERVAL, STATE_SYNC_RPC_SERVERS, VALIDATOR_PEERS, CHAIN_ID, GENESIS_PATH } from "../../constants/chainNetwork";
import { appTomlSnippet, configTomlSnippet } from "../../utils/nodePortal";
import { copyToClipboard } from "../playPage/Table/utils";

const CodeBlock: FC<{ title: string; code: string }> = ({ title, code }) => (
    <div className="mb-5">
        <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-300">{title}</span>
            <button onClick={() => copyToClipboard(code, `${title} copied`)} className="text-xs text-blue-400 hover:text-blue-300">
                copy
            </button>
        </div>
        <pre className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-200 overflow-x-auto whitespace-pre">{code}</pre>
    </div>
);

const Step: FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 mb-4">
        <h3 className="text-white font-semibold mb-3">
            <span className="text-blue-400 mr-2">{n}.</span>
            {title}
        </h3>
        {children}
    </div>
);

/** Step-by-step setup for a new full node: binary, genesis, seeds/PEX, state sync. Config is generated live. */
export const RunNodePanel: FC<{ overview: ChainOverview }> = ({ overview }) => {
    const { trustHeight, trustHash, error } = useStateSyncTrust(overview.latestHeight);

    return (
        <div>
            <Step n={1} title={`Install pokerchaind ${overview.appVersion}`}>
                <p className="text-sm text-gray-400 mb-3">
                    Run exactly the version the validators run (<span className="font-mono text-white">{overview.appVersion}</span>). A different binary
                    computes different state and halts with an AppHash mismatch. Releases ship from the block52/pokerchain GitHub releases.
                </p>
                <CodeBlock title="Check" code="pokerchaind version" />
            </Step>

            <Step n={2} title="Initialise the home dir and install the genesis">
                <CodeBlock
                    title="Shell"
                    code={[
                        `pokerchaind init <your-moniker> --chain-id ${CHAIN_ID} --home ~/.pokerchain`,
                        `curl -fsSL ${window.location.origin}${GENESIS_PATH} -o ~/.pokerchain/config/genesis.json`,
                        "sha256sum ~/.pokerchain/config/genesis.json   # must match the Network tab"
                    ].join("\n")}
                />
            </Step>

            <Step n={3} title="Peers, discovery and state sync">
                <p className="text-sm text-gray-400 mb-3">
                    Bootstrap from the seed nodes and let PEX find the rest; never make a single node your only peer. State sync fetches a recent snapshot
                    instead of replaying from genesis, which doesn&apos;t work across the chain&apos;s past upgrades. The trust point below is read live from
                    the chain.
                </p>
                {error && <p className="text-red-400 text-sm mb-3">Could not read a trust block: {error}</p>}
                {trustHeight !== null && trustHash !== null && (
                    <CodeBlock
                        title="config.toml"
                        code={configTomlSnippet({ validators: VALIDATOR_PEERS, seeds: SEED_NODES, rpcServers: STATE_SYNC_RPC_SERVERS, trustHeight, trustHash })}
                    />
                )}
                <CodeBlock title="app.toml" code={appTomlSnippet(SNAPSHOT_INTERVAL, overview.bondDenom)} />
            </Step>

            <Step n={4} title="Start and wait for sync">
                <CodeBlock
                    title="Shell"
                    code={[
                        "pokerchaind start --home ~/.pokerchain",
                        "",
                        "# in another shell: done when catching_up is false",
                        "curl -s localhost:26657/status | jq '.result.sync_info | {latest_block_height, catching_up}'"
                    ].join("\n")}
                />
                <p className="text-sm text-gray-400">
                    Open TCP 26656 (P2P) so other nodes can reach you. Run it under systemd with <span className="font-mono">Restart=always</span> so it
                    survives reboots. Every node must also run the bridge (<span className="font-mono">[bridge] enabled = true</span> and an{" "}
                    <span className="font-mono">ETHEREUM_RPC_URL</span>); see docs/ADD-VALIDATOR.md in the pokerchain repo.
                </p>
            </Step>
        </div>
    );
};
