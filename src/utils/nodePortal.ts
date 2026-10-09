/** Pure helpers for the /nodes self-service portal (joining the network and bonding a validator). */
import { P2PPeer } from "../constants/chainNetwork";

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Accepts either the full output of `pokerchaind comet show-validator`
 * (`{"@type":"/cosmos.crypto.ed25519.PubKey","key":"…"}`) or just the base64 key,
 * and returns the base64 key. Ed25519 keys are 32 bytes, i.e. 44 base64 chars.
 */
export const parseConsensusPubkey = (input: string): ParseResult<string> => {
    const trimmed = input.trim();
    if (!trimmed) return { ok: false, error: "Paste the output of `pokerchaind comet show-validator`" };

    let key = trimmed;
    if (trimmed.startsWith("{")) {
        let parsed: unknown;
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            return { ok: false, error: "That looks like JSON but doesn't parse" };
        }
        if (typeof parsed !== "object" || parsed === null || !("key" in parsed) || typeof parsed.key !== "string") {
            return { ok: false, error: "JSON has no \"key\" field" };
        }
        if ("@type" in parsed && parsed["@type"] !== "/cosmos.crypto.ed25519.PubKey") {
            return { ok: false, error: "Consensus keys on this chain are Ed25519 (/cosmos.crypto.ed25519.PubKey)" };
        }
        key = parsed.key;
    }

    if (!BASE64_RE.test(key) || key.length !== 44) {
        return { ok: false, error: "Expected a 32-byte Ed25519 key (44 base64 characters)" };
    }
    return { ok: true, value: key };
};

/**
 * Parses a user-entered amount of a 6-decimal token ("10", "10.5") into micro-units.
 * No floats: "0.1" + "0.2" style rounding would silently change a bond.
 */
export const parseMicroAmount = (input: string, decimals = 6): ParseResult<bigint> => {
    const trimmed = input.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return { ok: false, error: "Enter a number, e.g. 10" };
    const [whole, frac = ""] = trimmed.split(".");
    if (frac.length > decimals) return { ok: false, error: `At most ${decimals} decimal places` };
    return { ok: true, value: BigInt(whole + frac.padEnd(decimals, "0")) };
};

/**
 * How many validators can be offline at once before the chain halts, when each
 * has the given voting power. CometBFT commits with strictly more than 2/3 of the
 * total, so the offline power must stay below 1/3. Validators fail worst-first
 * (largest first) for a conservative answer.
 */
export const faultTolerance = (powers: bigint[]): number => {
    const total = powers.reduce((a, b) => a + b, 0n);
    if (total === 0n) return 0;
    const sorted = [...powers].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    let offline = 0n;
    let count = 0;
    for (const p of sorted) {
        // Would the chain still commit with this one offline too? online*3 > total*2
        if ((total - offline - p) * 3n > total * 2n) {
            offline += p;
            count += 1;
        } else {
            break;
        }
    }
    return count;
};

export const powerShareBps = (existingPowers: bigint[], newBond: bigint): number => {
    const total = existingPowers.reduce((a, b) => a + b, 0n) + newBond;
    if (total === 0n) return 0;
    return Number((newBond * 10_000n) / total);
};

/**
 * A validator holding 1/3 or more of the power halts the chain on its own if it
 * goes offline. The portal refuses to build such a bond.
 */
export const wouldControlLiveness = (existingPowers: bigint[], newBond: bigint): boolean => {
    const total = existingPowers.reduce((a, b) => a + b, 0n) + newBond;
    return newBond * 3n >= total;
};

export const stateSyncTrustHeight = (latestHeight: number, snapshotInterval: number): number => {
    const lastSnapshot = Math.floor(latestHeight / snapshotInterval) * snapshotInterval;
    return Math.max(1, lastSnapshot - 100);
};

export const base64ToHex = (b64: string): string => {
    const bin = atob(b64);
    let hex = "";
    for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
    return hex.toUpperCase();
};

export const peerString = (peers: P2PPeer[]): string => peers.map(p => `${p.nodeId}@${p.address}`).join(",");

export interface ConfigSnippetInput {
    validators: P2PPeer[];
    seeds: P2PPeer[];
    rpcServers: string[];
    trustHeight: number;
    trustHash: string;
}

/** config.toml lines for a new node: seeds + PEX for discovery, state sync to skip replay. */
export const configTomlSnippet = (i: ConfigSnippetInput): string => {
    return [
        "# ~/.pokerchain/config/config.toml",
        "[p2p]",
        `seeds = "${peerString(i.seeds)}"`,
        `persistent_peers = "${peerString(i.validators)}"`,
        "pex = true",
        'external_address = "<your-public-ip>:26656"   # if reachable from the internet',
        "",
        "[statesync]",
        "enable = true",
        `rpc_servers = "${i.rpcServers.join(",")}"`,
        `trust_height = ${i.trustHeight}`,
        `trust_hash = "${i.trustHash}"`,
        'trust_period = "168h0m0s"'
    ].join("\n");
};

/** app.toml lines: embedded engine, gasless, and serve snapshots for the next node. */
export const appTomlSnippet = (snapshotInterval: number, bondDenom: string): string => {
    return [
        "# ~/.pokerchain/config/app.toml",
        `minimum-gas-prices = "0${bondDenom}"`,
        "",
        "[state-sync]",
        `snapshot-interval = ${snapshotInterval}`,
        "snapshot-keep-recent = 2",
        "",
        "[pvm]",
        'embedded_engine = "embedded"'
    ].join("\n");
};

export const sumBigInt = (values: ReadonlyArray<bigint>): bigint => values.reduce((a, b) => a + b, 0n);

/** `part` as a share of `total` in basis points (0-10000), rounded down; null when there is no total, so callers show nothing instead of a made-up 0%. */
export const shareOfTotalBps = (part: bigint, total: bigint): number | null => {
    if (total <= 0n) return null;
    return Number((part * 10_000n) / total);
};

export const formatBps = (bps: number): string => `${(bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;

export const secondsBetween = (fromMs: number, toMs: number): number => Math.max(0, Math.floor((toMs - fromMs) / 1000));

export const formatAgo = (seconds: number): string => {
    if (seconds < 1) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
};


export interface ValidatorSummary {
    moniker: string;
    operatorAddress: string;
    status: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads a `/cosmos/staking/v1beta1/validators` response; entries without a moniker, operator address and status are counted as skipped. */
export const parseValidatorsResponse = (data: unknown): { validators: ValidatorSummary[]; skipped: number } => {
    if (!isRecord(data) || !Array.isArray(data.validators)) throw new Error("Validators response has no validators list");
    const validators: ValidatorSummary[] = [];
    let skipped = 0;
    for (const entry of data.validators as unknown[]) {
        const moniker = isRecord(entry) && isRecord(entry.description) ? entry.description.moniker : undefined;
        if (isRecord(entry) && typeof moniker === "string" && typeof entry.operator_address === "string" && typeof entry.status === "string") {
            validators.push({ moniker, operatorAddress: entry.operator_address, status: entry.status });
        } else {
            skipped += 1;
        }
    }
    return { validators, skipped };
};

/** The height a `/blocks/latest` response reports (Cosmos `block` or `sdk_block`), or null when it reports none. */
export const parseLatestBlockHeight = (data: unknown): string | null => {
    if (!isRecord(data)) return null;
    for (const key of ["block", "sdk_block"]) {
        const block = data[key];
        const header = isRecord(block) ? block.header : undefined;
        if (isRecord(header) && typeof header.height === "string" && header.height !== "") return header.height;
    }
    return null;
};
