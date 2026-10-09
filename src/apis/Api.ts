import HTTPClient from "./HTTPClient";
import { hasContent, hasValue } from "../utils/guards";
import type { PlayerSearchParams, PlayersListResponse, PlayerProfile, PlayerSessionsResponse, PlayerHandsResponse } from "../types/players";
import type { WithdrawalSignatureResponse } from "../utils/withdrawalSignature";

export class PaymentApi extends HTTPClient {
    public createCryptoPayment = (data: { amount: number; currency: string; cosmosAddress: string }) => this.post("/api/nowpayments/create", data);
    public getCurrencies = () => this.get("/api/nowpayments/currencies");
    public getPaymentStatus = (paymentId: string) => this.get(`/api/nowpayments/payment/${paymentId}`);
    public getDepositSession = (userAddress: string) => this.get(`/deposit-sessions/user/${userAddress}`);
    public getHotWalletInfo = () => this.get("/api/nowpayments/hot-wallet-info");
    // Hot-wallet routes: the proxy refuses them without the admin key (poker-vm#2638).
    public manualBridge = (data: { cosmosAddress: string; amount: string }, adminKey: string) =>
        this.post("/api/nowpayments/manual-bridge", data, sendsFunds(adminKey));
    public approveBridge = (adminKey: string) => this.post("/api/nowpayments/approve-bridge", undefined, sendsFunds(adminKey));
    public getUnbridgedPayments = (adminKey: string) => this.get("/api/nowpayments/unbridged", adminHeaders(adminKey));
    public retryBridge = (paymentId: string, adminKey: string) =>
        this.post(`/api/nowpayments/retry-bridge/${encodeURIComponent(paymentId)}`, undefined, sendsFunds(adminKey));
    public markBridged = (paymentId: string, txHash: string, adminKey: string) =>
        this.post(`/api/nowpayments/mark-bridged/${encodeURIComponent(paymentId)}`, { txHash }, adminHeaders(adminKey));
    public createDepositSession = (data: { userAddress: string; depositAddress: string }) => this.post("/deposit-sessions", data);
}

const adminHeaders = (adminKey: string) => ({ headers: { "X-Admin-Key": adminKey } });

/**
 * The proxy answers a hot-wallet send only after the Ethereum tx confirms (up to
 * 2 minutes), so these calls must not inherit PaymentApi's 5 s timeout: it fired
 * mid-send and the page reported a payment that had gone through as not sent.
 */
export const FUND_MOVING_TIMEOUT_MS = 180_000;
const sendsFunds = (adminKey: string) => ({ ...adminHeaders(adminKey), timeout: FUND_MOVING_TIMEOUT_MS });

export class CosmosApi extends HTTPClient {
    public getSentTransactions = (senderQuery: string) => this.get(`/cosmos/tx/v1beta1/txs?query=${encodeURIComponent(senderQuery)}&order_by=2&limit=10`);
    public getReceivedTransactions = (recipientQuery: string) =>
        this.get(`/cosmos/tx/v1beta1/txs?query=${encodeURIComponent(recipientQuery)}&order_by=2&limit=10`);
    /** The single most recent tx matching an event query (e.g. `message.sender='b521…'`). */
    public getLatestTransaction = (eventQuery: string) =>
        this.get(`/cosmos/tx/v1beta1/txs?query=${encodeURIComponent(eventQuery)}&order_by=2&limit=1`);
    public getValidators = (limit?: number) => this.get(`/cosmos/staking/v1beta1/validators${limit ? `?pagination.limit=${limit}` : ""}`);
    public getValidatorsByStatus = (status: string, signal?: AbortSignal) =>
        this.get(`/cosmos/staking/v1beta1/validators?status=${status}&pagination.limit=100`, { signal });
    public getAccounts = (limit?: number) => this.get(`/cosmos/auth/v1beta1/accounts${limit ? `?pagination.limit=${limit}` : ""}`);
    public getBalanceByAddress = (address: string) => this.get(`/cosmos/bank/v1beta1/balances/${address}`);
    /** A committed tx by hash (404 until it is in a block); `tx_response.code` is its execution result. */
    public getTx = (hash: string) => this.get(`/cosmos/tx/v1beta1/txs/${hash}`);
    /** The table record (GameStateResponseDTO JSON in `game`): carries format, variant and name. */
    public getGame = (gameId: string) => this.get(`/block52/pokerchain/poker/v1/game/${gameId}`);
    public getGameState = (gameId: string) => this.get(`block52/pokerchain/poker/v1/game_state/${gameId}`);
    public getGameStateAtBlock = (gameId: string, blockHeight: number) =>
        this.get(`block52/pokerchain/poker/v1/game_state/${gameId}`, {
            headers: { "x-cosmos-block-height": String(blockHeight) }
        });
    public getGameStateAt = (gameId: string, handNumber: number, actionIndex: number) =>
        this.get(`block52/pokerchain/poker/v1/game_state_at/${gameId}/${handNumber}/${actionIndex}`);
    public getPublicGameState = (gameId: string) => this.get(`/block52/pokerchain/poker/v1/game_state_public/${gameId}`);
    public getPublicGameStateAtBlock = (gameId: string, blockHeight: number) =>
        this.get(`/block52/pokerchain/poker/v1/game_state_public/${gameId}`, {
            headers: { "x-cosmos-block-height": String(blockHeight) }
        });
    public getWithdrawalRequests = () => this.get("/pokerchain/poker/withdrawal_requests");
    // A validator's signature for a pending withdrawal (read-only; pokerchain#392).
    public getWithdrawalSignature = (nonce: string) =>
        this.get<WithdrawalSignatureResponse>(`/block52/pokerchain/poker/v1/withdrawal_signature/${encodeURIComponent(nonce)}`);
    public getIsTxProcessed = (txHash: string) => this.get(`/block52/pokerchain/poker/v1/is_tx_processed/${txHash}`);
    public getNftAvatar = (cosmosAddress: string) => this.get(`/pokerchain/poker/nft_avatar/${cosmosAddress}`);
    // Tendermint base endpoints (used for node status / block-height probes across arbitrary node URLs)
    public getLatestBlock = (signal?: AbortSignal) => this.get("/cosmos/base/tendermint/v1beta1/blocks/latest", { signal });
    public getNodeInfo = (signal?: AbortSignal) => this.get("/cosmos/base/tendermint/v1beta1/node_info", { signal });
    public getSyncing = (signal?: AbortSignal) => this.get("/cosmos/base/tendermint/v1beta1/syncing", { signal });
    public getBlockByHeight = (height: number) => this.get(`/cosmos/base/tendermint/v1beta1/blocks/${height}`);
    public getStakingParams = () => this.get("/cosmos/staking/v1beta1/params");
    public getSlashingParams = () => this.get("/cosmos/slashing/v1beta1/params");
    /** Poker module params, incl. min_validator_bond (USDC micro-units, enforced in the ante handler). */
    public getPokerParams = () => this.get("/block52/pokerchain/poker/v1/params");
}

/**
 * CometBFT RPC (a node's `rpc` endpoint, e.g. https://node1.block52.xyz/rpc/).
 * Used for historical reads: abci_query takes `height` as a query parameter, so it
 * needs no custom header (unlike the REST API's x-cosmos-block-height).
 */
export class CometRpcApi extends HTTPClient {
    /** Txs matching a CometBFT event query, e.g. `hand_ended.game_id='0x…'`. */
    public txSearch = (query: string, perPage = 1, orderBy: "asc" | "desc" = "desc") =>
        this.get(`tx_search?query=${encodeURIComponent(`"${query}"`)}&per_page=${perPage}&order_by=${encodeURIComponent(`"${orderBy}"`)}`);
    /** ABCI query of a gRPC method path with hex-encoded protobuf `data`, at `height` (0 = latest). */
    public abciQuery = (path: string, dataHex: string, height: number) =>
        this.get(`abci_query?path=${encodeURIComponent(`"${path}"`)}&data=${dataHex}&height=${height}`);
}

export class IndexerApi extends HTTPClient {
    public getCardStats = () => this.get("/api/v1/stats/cards");
    public getSyncStatus = () => this.get("/api/v1/status");
    public getSummaryStats = () => this.get("/api/v1/stats/summary");
    public getRandomnessAnalysis = () => this.get("/api/v1/analysis/randomness");
    public getHand = (gameId: string, handNumber: string) => this.get(`/api/v1/hands/${gameId}/${handNumber}`);
    public getHands = (gameId: string) => this.get(`/api/v1/hands?game_id=${gameId}&limit=100`);
    /** Returns the single most recent indexed hand across all games. Used as a live test fixture. */
    public getRecentHand = () => this.get("/api/v1/hands?limit=1");

    // Player directory (ui#589). Money fields are raw USDC micro-units; percentage
    // fields are integers scaled x100. See indexer API.md.
    public getPlayers = (params: PlayerSearchParams = {}) => this.get<PlayersListResponse>(`/api/v1/players${buildPlayerQuery(params)}`);
    public getPlayerProfile = (address: string) => this.get<PlayerProfile>(`/api/v1/players/${encodeURIComponent(address)}/stats`);
    public getPlayerSessions = (address: string, limit = 20, offset = 0) =>
        this.get<PlayerSessionsResponse>(`/api/v1/players/${encodeURIComponent(address)}/sessions?limit=${limit}&offset=${offset}`);
    // Hands a wallet played, newest first (ui#721).
    public getPlayerHands = (address: string, limit: number, offset: number) =>
        this.get<PlayerHandsResponse>(`/api/v1/players/${encodeURIComponent(address)}/hands?limit=${limit}&offset=${offset}`);
}

// Serialize player-directory query params, omitting empty values.
function buildPlayerQuery(params: PlayerSearchParams): string {
    const q = new URLSearchParams();
    if (hasContent(params.search)) q.set("search", params.search!.trim());
    if (hasContent(params.sort)) q.set("sort", params.sort!);
    if (hasContent(params.order)) q.set("order", params.order!);
    if (hasValue(params.limit)) q.set("limit", String(params.limit));
    if (hasValue(params.offset)) q.set("offset", String(params.offset));
    const s = q.toString();
    return s ? `?${s}` : "";
}
