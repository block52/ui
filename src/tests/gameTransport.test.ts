import { getGameTransport, getGatewayHttpUrl, getGatewayWsUrl, normalizeGatewayMessage } from "../utils/gameTransport";

// jest maps utils/viteEnv to process.env (see jest.config.js), so transport
// flags are driven through process.env here.
describe("game transport selection", () => {
    const saved = { transport: process.env.VITE_GAME_TRANSPORT, url: process.env.VITE_GATEWAY_URL };

    afterEach(() => {
        process.env.VITE_GAME_TRANSPORT = saved.transport;
        process.env.VITE_GATEWAY_URL = saved.url;
        if (saved.transport === undefined) delete process.env.VITE_GAME_TRANSPORT;
        if (saved.url === undefined) delete process.env.VITE_GATEWAY_URL;
    });

    it("defaults to chain — gateway is the opt-out (#2469)", () => {
        delete process.env.VITE_GAME_TRANSPORT;
        expect(getGameTransport()).toBe("chain");
    });

    it("selects gateway only on the exact flag", () => {
        process.env.VITE_GAME_TRANSPORT = "gateway";
        expect(getGameTransport()).toBe("gateway");

        process.env.VITE_GAME_TRANSPORT = "GATEWAY";
        expect(getGameTransport()).toBe("gateway");

        process.env.VITE_GAME_TRANSPORT = "something-else";
        expect(getGameTransport()).toBe("chain");
    });

    it("derives the ws endpoint from the http base URL", () => {
        process.env.VITE_GATEWAY_URL = "https://pvm.block52.xyz/gateway";
        expect(getGatewayWsUrl()).toBe("wss://pvm.block52.xyz/gateway/ws");

        process.env.VITE_GATEWAY_URL = "http://localhost:8546/";
        expect(getGatewayWsUrl()).toBe("ws://localhost:8546/ws");
    });

    it("falls back to the production gateway URL", () => {
        delete process.env.VITE_GATEWAY_URL;
        expect(getGatewayHttpUrl()).toBe("https://pvm.block52.xyz/gateway");
    });
});

describe("normalizeGatewayMessage", () => {
    const gatewayState = {
        type: "state",
        gameId: "game-1",
        index: 7,
        state: {
            gameId: "game-1",
            format: "cash",
            variant: "texas-holdem",
            gameState: { round: "preflop", players: [] }
        }
    };

    it("maps a gateway state message onto the canonical Cosmos shape", () => {
        const normalized = normalizeGatewayMessage(gatewayState);
        expect(normalized).toEqual({
            gameId: "game-1",
            event: "state",
            data: {
                format: "cash",
                variant: "texas-holdem",
                gameState: { round: "preflop", players: [] }
            }
        });
    });

    it("ignores non-state gateway messages", () => {
        expect(normalizeGatewayMessage({ type: "subscribed", gameId: "game-1" })).toBeNull();
        expect(normalizeGatewayMessage({ type: "ack", gameId: "game-1" })).toBeNull();
        expect(normalizeGatewayMessage({ type: "error", gameId: "game-1" })).toBeNull();
    });

    it("ignores chain messages — they already have the canonical shape", () => {
        expect(normalizeGatewayMessage({ event: "state", gameId: "game-1", data: {} } as never)).toBeNull();
    });

    it("ignores state messages without a payload", () => {
        expect(normalizeGatewayMessage({ type: "state", gameId: "game-1" })).toBeNull();
        expect(normalizeGatewayMessage({ type: "state", gameId: "game-1", state: {} })).toBeNull();
    });
});
