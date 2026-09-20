/**
 * Convert a `GET /cosmos/tx/v1beta1/txs/{hash}` response into a {@link TxVerdict}
 * (ui#609). One centralized, tested conversion (Commandment 12); no defaults —
 * a response without an execution code yields `null` ("no verdict"), it is never
 * assumed to have succeeded.
 *
 * CosmJS `signAndBroadcast` resolves normally when EXECUTION fails: the only
 * failure signal is `tx_response.code !== 0`, and `raw_log` carries the reason.
 */
import type { TxVerdict } from "./types";
import { hasValue } from "../utils/guards";

interface TxResponseShape {
    tx_response?: {
        code?: unknown;
        raw_log?: unknown;
        height?: unknown;
        txhash?: unknown;
    };
}

export function parseTxVerdict(response: unknown, hash: string): TxVerdict | null {
    if (!hasValue(response) || typeof response !== "object") {
        return null;
    }
    const txResponse = (response as TxResponseShape).tx_response;
    if (!hasValue(txResponse) || typeof txResponse !== "object") {
        return null;
    }
    const { code, raw_log: rawLog, height, txhash } = txResponse;
    if (typeof code !== "number") {
        return null;
    }
    const parsedHeight = typeof height === "number" ? height : typeof height === "string" ? Number(height) : Number.NaN;
    return {
        hash: typeof txhash === "string" && txhash !== "" ? txhash : hash,
        code,
        rawLog: typeof rawLog === "string" ? rawLog : "",
        height: Number.isFinite(parsedHeight) ? parsedHeight : 0
    };
}
