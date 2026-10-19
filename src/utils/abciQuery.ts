/**
 * Minimal protobuf codec for CometBFT `abci_query` of the chain's query messages:
 * the single-string requests (`string <name> = 1`, e.g. QueryGameStatePublicRequest)
 * and the signed QueryGameStateRequest (strings + an int64 timestamp). abci_query
 * takes the height as a plain query parameter, so historical queries need no custom
 * header (the REST API's `x-cosmos-block-height` header is not allowed by its CORS
 * policy).
 */

function encodeVarint(n: number): number[] {
    if (!Number.isSafeInteger(n) || n < 0) {
        throw new Error(`Cannot encode ${n} as a protobuf varint`);
    }
    const out: number[] = [];
    let v = n;
    while (v > 0x7f) {
        out.push((v % 0x80) | 0x80);
        v = Math.floor(v / 0x80);
    }
    out.push(v);
    return out;
}

/** A length-delimited (wire type 2) string field. */
function encodeStringField(fieldNumber: number, value: string): number[] {
    const bytes = new TextEncoder().encode(value);
    return [(fieldNumber << 3) | 2, ...encodeVarint(bytes.length), ...bytes];
}

/** A varint (wire type 0) field. */
function encodeVarintField(fieldNumber: number, value: number): number[] {
    return [fieldNumber << 3, ...encodeVarint(value)];
}

const toHex = (bytes: number[]): string => "0x" + bytes.map(b => b.toString(16).padStart(2, "0")).join("");

/** `0x`-prefixed hex of a message `{ string field1 = 1 }`, as abci_query's `data` param. */
export function encodeStringField1(value: string): string {
    return toHex(encodeStringField(1, value));
}

/** The chain's authenticated game-state query (pokerchain QueryGameStateRequest). */
export interface GameStateRequest {
    gameId: string;
    /** The requesting player's b52 address: their own hole cards come back unmasked. */
    playerAddress: string;
    /** Unix seconds; the node accepts it within an hour of the queried block's time. */
    timestamp: number;
    /** EIP-191 signature of `pokerchain-query:<timestamp>` by the player's key. */
    signature: string;
}

/**
 * `0x`-prefixed hex of a QueryGameStateRequest
 * (`string game_id = 1; string player_address = 2; int64 timestamp = 3; string signature = 4`).
 */
export function encodeGameStateRequest(request: GameStateRequest): string {
    return toHex([
        ...encodeStringField(1, request.gameId),
        ...encodeStringField(2, request.playerAddress),
        ...encodeVarintField(3, request.timestamp),
        ...encodeStringField(4, request.signature)
    ]);
}

/** Decodes field 1 (a string) from a base64 protobuf message, as returned in abci_query `value`. */
export function decodeStringField1(base64: string): string {
    const bin = atob(base64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    if (bytes.length === 0) return "";
    if (bytes[0] !== 0x0a) {
        throw new Error(`Unexpected protobuf tag 0x${bytes[0].toString(16)} (expected field 1, string)`);
    }
    let i = 1;
    let len = 0;
    let shift = 0;
    for (;;) {
        if (i >= bytes.length) throw new Error("Truncated protobuf length");
        const b = bytes[i++];
        len |= (b & 0x7f) << shift;
        if ((b & 0x80) === 0) break;
        shift += 7;
    }
    if (i + len > bytes.length) throw new Error("Truncated protobuf string");
    return new TextDecoder().decode(bytes.subarray(i, i + len));
}

interface AbciQueryResponse {
    result?: { response?: { code?: number; log?: string; value?: string | null } };
}

/** The decoded string field from an abci_query response; throws with the node's log on failure. */
export function parseAbciStringResponse(response: unknown): string {
    const r = (response as AbciQueryResponse)?.result?.response;
    if (!r) throw new Error("Malformed abci_query response");
    if (r.code && r.code !== 0) throw new Error(r.log || `abci_query failed with code ${r.code}`);
    if (!r.value) throw new Error("abci_query returned no value");
    return decodeStringField1(r.value);
}
