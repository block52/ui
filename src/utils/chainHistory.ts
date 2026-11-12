import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import type { CometRpcApi } from "../apis/Api";
import { encodeStringField1, parseAbciStringResponse } from "./abciQuery";
import { GAME_STATE_PUBLIC_PATH, parseGameStateJson } from "./handReplay";

/** A table's public (masked) game state as of block `height` (0 = latest), via the node's ABCI query. */
export const publicStateAt = async (rpc: CometRpcApi, tableId: string, height: number): Promise<TexasHoldemStateDTO> =>
    parseGameStateJson(parseAbciStringResponse(await rpc.abciQuery(GAME_STATE_PUBLIC_PATH, encodeStringField1(tableId), height))).state;
