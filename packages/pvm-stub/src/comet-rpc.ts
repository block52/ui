import { createHash } from "node:crypto";
import { TxRaw, TxBody } from "cosmjs-types/cosmos/tx/v1beta1/tx.js";
import { BaseAccount } from "cosmjs-types/cosmos/auth/v1beta1/auth.js";
import { QueryAccountRequest, QueryAccountResponse } from "cosmjs-types/cosmos/auth/v1beta1/query.js";
import { Any } from "cosmjs-types/google/protobuf/any.js";
import { applyAction, getFrameDelayMs, cosmosStateMessage } from "./state.js";
import { broadcast, broadcastRaw } from "./chain-ws.js";
import type { Action } from "./holdem.js";

/**
 * Minimal CometBFT JSON-RPC emulator (the chain-direct half of the stub).
 *
 * Chain-direct actions submit via the SDK's CosmJS SigningStargateClient, which
 * drives CometBFT JSON-RPC 2.0 over `POST /`. We implement just enough of that
 * surface for `signAndBroadcast` to succeed against the stub:
 *
 *   status            -> node/chain identity (chainId MUST be "pokerchain" or
 *                        CosmJS rejects the signature's chain-id)
 *   abci_query        -> account number + sequence (auth Query/Account)
 *   broadcast_tx_sync -> decode the poker Msg, drive holdem.applyAction, ack
 *   tx                -> report the tx committed (performActionSync waits on this)
 *
 * We do NOT verify signatures (the stub is dev/test only); we trust the decoded
 * message and advance game state, then push the resulting frame over the chain
 * WS exactly as a real node relay would.
 */

// Per-address sequence. CosmJS signs with whatever we report; the stub doesn't
// verify, so a simple monotonic counter keeps consecutive broadcasts happy.
const sequences = new Map<string, number>();
// hashHex -> the tx's base64 bytes, so a `tx`/`tx_search` poll after
// broadcast_tx_sync resolves with the real (non-empty) tx CosmJS asserts on.
const committedTxs = new Map<string, string>();

const FIXED_HEIGHT = "2659803";

function statusResult(): unknown {
    return {
        node_info: {
            protocol_version: { p2p: "8", block: "11", app: "0" },
            id: "2aed496d3ee5201b510b7575b1523ffde51bc51e",
            listen_addr: "tcp://0.0.0.0:26656",
            network: "pokerchain",
            version: "0.38.19",
            channels: "402021222330386061",
            moniker: "pvm-stub",
            other: { tx_index: "on", rpc_address: "tcp://0.0.0.0:26657" }
        },
        sync_info: {
            latest_block_hash: "34B5B38ED24F320DA11CF610269678331EAD9830E5E19C8E4FADFDF2A0C58068",
            latest_app_hash: "38C198C5B69E2E9731752175A584E08837E96D532E169BC270915F16A6A5A96B",
            latest_block_height: FIXED_HEIGHT,
            latest_block_time: "2026-08-11T01:13:12.885469748Z",
            earliest_block_height: "1",
            catching_up: false
        },
        validator_info: {
            address: "D06E3FBFCB70D1564B4FECE7F928B9C17E2B35A2",
            pub_key: { type: "tendermint/PubKeyEd25519", value: "XCdKkErz4Tp+xamCSHoMVr1Tg0ekt4EMCG79Khi6r94=" },
            voting_power: "1000000"
        }
    };
}

function hexToBytes(hex: string): Uint8Array {
    const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
}

function accountResult(dataHex: string): unknown {
    let address = "";
    try {
        address = QueryAccountRequest.decode(hexToBytes(dataHex)).address;
    } catch {
        // fall through with empty address
    }
    const sequence = sequences.get(address) ?? 0;
    const account = Any.fromPartial({
        typeUrl: "/cosmos.auth.v1beta1.BaseAccount",
        value: BaseAccount.encode(
            BaseAccount.fromPartial({
                address,
                accountNumber: BigInt(0),
                sequence: BigInt(sequence)
            })
        ).finish()
    });
    const value = QueryAccountResponse.encode(QueryAccountResponse.fromPartial({ account })).finish();
    return {
        response: {
            code: 0,
            log: "",
            info: "",
            index: "0",
            key: null,
            value: Buffer.from(value).toString("base64"),
            height: FIXED_HEIGHT,
            codespace: ""
        }
    };
}

/** Map a decoded poker Msg (typeUrl + fields) into a holdem engine Action. */
function msgToAction(typeUrl: string, msg: Record<string, unknown>): { gameId: string; action: Action } | null {
    const gameId = String(msg.gameId ?? msg.game_id ?? "");
    const address = String(msg.player ?? msg.creator ?? "");
    switch (typeUrl) {
        case "/pokerchain.poker.v1.MsgPerformAction":
            return { gameId, action: { action: String(msg.action ?? ""), amount: String(msg.amount ?? "0"), address, data: String(msg.data ?? "") } };
        case "/pokerchain.poker.v1.MsgJoinGame": {
            const seat = Number(msg.seat ?? msg.seatNumber ?? msg.seat_number ?? 0);
            return { gameId, action: { action: "join", amount: String(msg.buyInAmount ?? msg.buy_in_amount ?? msg.amount ?? "0"), address, data: `seat=${seat}` } };
        }
        case "/pokerchain.poker.v1.MsgLeaveGame":
            return { gameId, action: { action: "leave", amount: "0", address, data: "" } };
        case "/pokerchain.poker.v1.MsgTopUp":
            return { gameId, action: { action: "top-up", amount: String(msg.amount ?? "0"), address, data: "" } };
        default:
            return null;
    }
}

/** Apply one action and push the resulting frame(s) over the chain WS. */
function dispatch(gameId: string, action: Action): void {
    const frameDelayMs = getFrameDelayMs();
    if (frameDelayMs > 0) {
        const frames: unknown[] = [];
        applyAction(gameId, action, () => {
            const frame = cosmosStateMessage(gameId);
            if (frame) frames.push(structuredClone(frame));
        });
        frames.forEach((frame, i) => {
            if (i === 0) broadcastRaw(gameId, frame);
            else setTimeout(() => broadcastRaw(gameId, frame), i * frameDelayMs);
        });
    } else {
        applyAction(gameId, action);
        broadcast(gameId);
    }
}

function broadcastResult(txBase64: string): unknown {
    const txBytes = Buffer.from(txBase64, "base64");
    const hash = createHash("sha256").update(txBytes).digest("hex").toUpperCase();
    try {
        const raw = TxRaw.decode(txBytes);
        const body = TxBody.decode(raw.bodyBytes);
        for (const anyMsg of body.messages) {
            const decoded = decodeMsg(anyMsg);
            if (!decoded) continue;
            const mapped = msgToAction(anyMsg.typeUrl, decoded);
            if (mapped) {
                sequences.set(mapped.action.address ?? "", (sequences.get(mapped.action.address ?? "") ?? 0) + 1);
                dispatch(mapped.gameId, mapped.action);
            }
        }
    } catch (err) {
        console.warn(`[pvm-stub] tx decode failed: ${(err as Error).message}`);
    }
    committedTxs.set(hash, txBase64);
    return { code: 0, data: "", log: "", codespace: "", hash };
}

// Decode a poker Msg's protobuf `value` by typeUrl. The generated decoders live
// in the SDK; we lazily resolve them via its registry so field names match.
let sdkRegistry: { decode(input: { typeUrl: string; value: Uint8Array }): unknown } | null = null;
async function loadRegistry(): Promise<void> {
    if (sdkRegistry) return;
    const sdk = await import("@block52/poker-vm-sdk");
    sdkRegistry = sdk.registry as unknown as typeof sdkRegistry;
}
function decodeMsg(anyMsg: { typeUrl: string; value: Uint8Array }): Record<string, unknown> | null {
    if (!sdkRegistry) return null;
    try {
        return sdkRegistry.decode(anyMsg) as Record<string, unknown>;
    } catch {
        return null;
    }
}

function oneTx(hashHex: string): unknown {
    return {
        hash: hashHex,
        height: FIXED_HEIGHT,
        index: 0,
        tx_result: { code: 0, data: "", log: "", info: "", gas_wanted: "200000", gas_used: "100000", events: [], codespace: "" },
        // CosmJS asserts tx is non-empty base64 — return the real committed bytes.
        tx: committedTxs.get(hashHex) ?? ""
    };
}

function txResult(hashParam: string): unknown {
    // CosmJS sends the hash base64-encoded on the `tx` query.
    let hashHex = hashParam;
    try {
        hashHex = Buffer.from(hashParam, "base64").toString("hex").toUpperCase();
    } catch {
        // already hex
    }
    return oneTx(hashHex);
}

/**
 * CosmJS polls for inclusion via `tx_search` with query `tx.hash='<HEX>'`.
 * We committed the tx synchronously in broadcast_tx_sync, so report it found.
 */
function txSearchResult(query: string): unknown {
    const match = /tx\.hash='([0-9A-Fa-f]+)'/.exec(query);
    const hashHex = match ? match[1].toUpperCase() : "";
    const found = hashHex !== "" && committedTxs.has(hashHex);
    return {
        txs: found ? [oneTx(hashHex)] : [],
        total_count: found ? "1" : "0"
    };
}

/**
 * Handle one CometBFT JSON-RPC request. Returns the JSON-RPC envelope body.
 * Unknown methods return an empty result (and log) so we can spot any missing
 * surface during test runs rather than failing opaquely.
 */
export async function handleCometRpc(body: { id?: unknown; method?: string; params?: Record<string, unknown> }): Promise<unknown> {
    await loadRegistry();
    const id = body.id ?? 1;
    const params = body.params ?? {};
    const envelope = (result: unknown) => ({ jsonrpc: "2.0", id, result });

    switch (body.method) {
        case "status":
            return envelope(statusResult());
        case "health":
            return envelope({});
        case "abci_info":
            return envelope({ response: { data: "pokerchain", version: "0.1.116", last_block_height: FIXED_HEIGHT, last_block_app_hash: "" } });
        case "abci_query": {
            const path = String(params.path ?? "");
            if (path.endsWith("Query/Account")) return envelope(accountResult(String(params.data ?? "")));
            // Any other ABCI query: benign empty ok response.
            return envelope({ response: { code: 0, value: null, height: FIXED_HEIGHT } });
        }
        case "broadcast_tx_sync":
        case "broadcast_tx_async":
            return envelope(broadcastResult(String(params.tx ?? "")));
        case "tx":
            return envelope(txResult(String(params.hash ?? "")));
        case "tx_search":
            return envelope(txSearchResult(String(params.query ?? "")));
        default:
            console.warn(`[pvm-stub] UNHANDLED CometBFT method=${body.method} params=${JSON.stringify(params)}`);
            return envelope({});
    }
}
