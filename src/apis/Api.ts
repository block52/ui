import HTTPClient from "./HTTPClient";

export class PaymentApi extends HTTPClient {
    public createCryptoPayment = (data: { amount: number; currency: string; cosmosAddress: string }) => this.post("/api/nowpayments/create", data);
    public getCurrencies = () => this.get("/api/nowpayments/currencies");
    public getPaymentStatus = (paymentId: string) => this.get(`/api/nowpayments/payment/${paymentId}`);
    public getDepositSession = (userAddress: string) => this.get(`/deposit-sessions/user/${userAddress}`);
    public getHotWalletInfo = () => this.get("/api/nowpayments/hot-wallet-info");
    public manualBridge = (data: { cosmosAddress: string; amount: string }) => this.post("/api/nowpayments/manual-bridge", data);
    public approveBridge = () => this.post("/api/nowpayments/approve-bridge");
}

export class CosmosApi extends HTTPClient {
    public getSentTransactions = (senderQuery: string) => this.get(`/cosmos/tx/v1beta1/txs?query=${encodeURIComponent(senderQuery)}&order_by=2&limit=10`);
    public getReceivedTransactions = (recipientQuery: string) =>
        this.get(`/cosmos/tx/v1beta1/txs?query=${encodeURIComponent(recipientQuery)}&order_by=2&limit=10`);
    public getValidators = (limit?: number) => this.get(`/cosmos/staking/v1beta1/validators${limit ? `?pagination.limit=${limit}` : ""}`);
    public getValidatorsByStatus = (status: string, signal?: AbortSignal) =>
        this.get(`/cosmos/staking/v1beta1/validators?status=${status}&pagination.limit=100`, { signal });
    public getAccounts = (limit?: number) => this.get(`/cosmos/auth/v1beta1/accounts${limit ? `?pagination.limit=${limit}` : ""}`);
    public getBalanceByAddress = (address: string) => this.get(`/cosmos/bank/v1beta1/balances/${address}`);
    public getGameState = (gameId: string) => this.get(`block52/pokerchain/poker/v1/game_state/${gameId}`);
    public getGameStateAtBlock = (gameId: string, blockHeight: number) =>
        this.get(`block52/pokerchain/poker/v1/game_state/${gameId}`, {
            headers: { "x-cosmos-block-height": String(blockHeight) }
        });
    public getGameStateAt = (gameId: string, handNumber: number, actionIndex: number) =>
        this.get(`block52/pokerchain/poker/v1/game_state_at/${gameId}/${handNumber}/${actionIndex}`);
    public getWithdrawalRequests = () => this.get("/pokerchain/poker/withdrawal_requests");
    public getIsTxProcessed = (txHash: string) => this.get(`/block52/pokerchain/poker/v1/is_tx_processed/${txHash}`);
    public getNftAvatar = (cosmosAddress: string) => this.get(`/pokerchain/poker/nft_avatar/${cosmosAddress}`);
}

export class IndexerApi extends HTTPClient {
    public getCardStats = () => this.get("/api/v1/stats/cards");
    public getSyncStatus = () => this.get("/api/v1/status");
    public getSummaryStats = () => this.get("/api/v1/stats/summary");
    public getRandomnessAnalysis = () => this.get("/api/v1/analysis/randomness");
    public getHand = (gameId: string, handNumber: string) => this.get(`/api/v1/hands/${gameId}/${handNumber}`);
    public getHands = (gameId: string) => this.get(`/api/v1/hands?game_id=${gameId}&limit=100`);
}
