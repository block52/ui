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
import { hasContent, isNumber, isRecord, isString } from "../utils/guards";

export function parseTxVerdict(response: unknown, hash: string): TxVerdict | null {
    if (!isRecord(response)) {
        return null;
    }
    const txResponse = response.tx_response;
    if (!isRecord(txResponse)) {
        return null;
    }
    const { code, raw_log: rawLog, height, txhash } = txResponse;
    if (!isNumber(code)) {
        return null;
    }
    const parsedHeight = isNumber(height) ? height : isString(height) ? Number(height) : Number.NaN;
    return {
        hash: isString(txhash) && hasContent(txhash) ? txhash : hash,
        code,
        rawLog: isString(rawLog) ? rawLog : "",
        height: Number.isFinite(parsedHeight) ? parsedHeight : 0
    };
}
