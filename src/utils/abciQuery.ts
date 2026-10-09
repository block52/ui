/**
 * Minimal protobuf codec for CometBFT `abci_query` of messages whose only field is
 * `string <name> = 1` (e.g. QueryGameStatePublicRequest/Response). abci_query takes
 * the height as a plain query parameter, so historical queries need no custom header
 * (the REST API's `x-cosmos-block-height` header is not allowed by its CORS policy).
 */

function encodeVarint(n: number): number[] {
    const out: number[] = [];
    let v = n;
    while (v > 0x7f) {
        out.push((v & 0x7f) | 0x80);
        v >>>= 7;
    }
    out.push(v);
    return out;
}

/** `0x`-prefixed hex of a message `{ string field1 = 1 }`, as abci_query's `data` param. */
export function encodeStringField1(value: string): string {
    const bytes = new TextEncoder().encode(value);
    const all = [0x0a, ...encodeVarint(bytes.length), ...bytes];
    return "0x" + all.map(b => b.toString(16).padStart(2, "0")).join("");
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
