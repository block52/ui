/**
 * Static facts about the Pokerchain mainnet network, for the /nodes portal.
 *
 * KEEP IN SYNC with block52/pokerchain VALIDATORS.md (topology, peers, seeds) and
 * GENESIS.md (genesis hash). Everything the chain can answer at runtime (validator
 * set, bonds, params, versions, heights) is queried live instead of listed here.
 */

export const CHAIN_ID = "pokerchain";

/** Served from public/genesis.json. SHA-256 of the exact file bytes (2026-09-02 USDC-only reset). */
export const GENESIS_PATH = "/genesis.json";
export const GENESIS_SHA256 = "ae808c4889f1c520c92f40d55dd984d41fec7a03b0373170dcafdeeaf1454731";

export interface P2PPeer {
    name: string;
    nodeId: string;
    address: string; // host:port
}

/** Bonded validators' p2p endpoints: other validators list these as persistent_peers. */
export const VALIDATOR_PEERS: P2PPeer[] = [
    { name: "Block52 (node1)", nodeId: "2aed496d3ee5201b510b7575b1523ffde51bc51e", address: "170.64.205.169:26656" },
    { name: "Texas Hodl", nodeId: "8b927a7e936fe95477284b6378f40bf1c8d695e9", address: "170.64.188.31:26656" },
    { name: "millerservices", nodeId: "271dd98bdcc676e220fee253e78746397e780585", address: "134.199.145.121:26656" }
];

/** Seed / full nodes: the address book new nodes bootstrap from (PEX does the rest). */
export const SEED_NODES: P2PPeer[] = [
    { name: "seed-sgp", nodeId: "7037f79644b7c25d3194d37f34cd93e3d2527d5b", address: "159.89.199.49:26656" },
    { name: "seed-vultr", nodeId: "7b6fc0bdfffad39e94390eba12da18a687bcce45", address: "139.180.181.33:26656" }
];

/** Direct CometBFT RPCs for state sync's light client (needs two). */
export const STATE_SYNC_RPC_SERVERS = ["http://node1.block52.xyz:26657", "http://node.texashodl.net:26657"];

/** node1 serves state-sync snapshots every this many blocks (app.toml snapshot-interval). */
export const SNAPSHOT_INTERVAL = 1000;
