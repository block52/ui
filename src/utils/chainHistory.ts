import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import type { CometRpcApi } from "../apis/Api";
import { encodeStringField1, parseAbciStringResponse } from "./abciQuery";
import { hasContent, hasValue, isString } from "./guards";
import { GAME_STATE_PUBLIC_PATH, parseGameStateJson } from "./handReplay";

/** A table's public (masked) game state as of block `height` (0 = latest), via the node's ABCI query. */
export const publicStateAt = async (rpc: CometRpcApi, tableId: string, height: number): Promise<TexasHoldemStateDTO> =>
    parseGameStateJson(parseAbciStringResponse(await rpc.abciQuery(GAME_STATE_PUBLIC_PATH, encodeStringField1(tableId), height))).state;

/**
 * True when an abci_query failed because that block's app state is gone.
 * A missing game at a height the node still has is not this: that answer is real.
 */
export function isPrunedHeightError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : isString(err) ? err : "";
    if (!hasContent(message)) return false;
    return /version does not exist|failed to load state at height|height \d+ is not available|lowest height is \d+/i.test(message);
}

/** Block52's RPC when it is a different node from the one already asked. Localhost stays local. */
export function block52HistoryRpc(current: { name?: string; rpc: string }, presets: ReadonlyArray<{ name: string; rpc: string }>): string | undefined {
    if (current.name === "Localhost") return undefined;
    const official = presets.find(preset => preset.name === "Block52");
    if (!hasValue(official) || !hasContent(official.rpc) || official.rpc === current.rpc) return undefined;
    return official.rpc;
}

/**
 * Read public state on `primaryRpc`. If that height has been pruned, ask
 * `fallbackRpc` the same query. Any other failure stays on the first node.
 */
export async function publicStateAtFallingBack(
    read: (rpcUrl: string) => Promise<TexasHoldemStateDTO>,
    primaryRpc: string,
    fallbackRpc: string | undefined
): Promise<TexasHoldemStateDTO> {
    try {
        return await read(primaryRpc);
    } catch (err) {
        if (!hasContent(fallbackRpc) || fallbackRpc === primaryRpc || !isPrunedHeightError(err)) throw err;
        console.error("Chain state at this height was pruned; retrying on Block52:", err);
        return read(fallbackRpc);
    }
}
