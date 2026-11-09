import { renderHook, waitFor } from "@testing-library/react";
import { useHandVerification } from "./useHandVerification";

// ui#972: a finished hand's evidence comes from its hand_started tx (the seed,
// via the REST tx), its hand_ended tx (hand_completed: board + shown hands) and
// the public state at that block (dealt seats). A running hand is never fetched.

const SEED = "45583a8e8a5fbb6e3d66baa1960e44ef8723c3498d805b67bf0a0eee118a17f3";

const mockTxSearch = jest.fn();
const mockGetTx = jest.fn();
const mockPublicStateAt = jest.fn();

jest.mock("../../context/NetworkContext", () => ({
    useNetwork: () => ({ currentNetwork: { name: "Localhost", rpc: "http://rpc", rest: "http://rest" } }),
    NETWORK_PRESETS: []
}));
jest.mock("../../context/CosmosApiContext", () => {
    const rpc = { txSearch: (...args: unknown[]) => mockTxSearch(...args) };
    const rest = { getTx: (...args: unknown[]) => mockGetTx(...args) };
    return { useCometRpcApiFactory: () => () => rpc, useCosmosApiFactory: () => () => rest };
});
jest.mock("../../utils/chainHistory", () => ({ publicStateAt: (...args: unknown[]) => mockPublicStateAt(...args) }));

const tx = (hash: string, height: number, events: unknown[] = []) => ({ result: { txs: [{ hash, height: String(height), tx_result: { events } }] } });
const handCompleted = (board: string, revealed: string) => ({
    type: "hand_completed",
    attributes: [
        { key: "community_cards", value: board },
        { key: "revealed_hole_cards", value: revealed }
    ]
});

const args = { tableId: "0x85", handNumber: 12, holeCardsPerPlayer: 2 };

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockTxSearch.mockImplementation((query: string) =>
        Promise.resolve(query.startsWith("hand_started") ? tx("START", 962868) : tx("END", 962890, [handCompleted("6H,KS,KD,JS,QH", "3S,KC,JD,QD")]))
    );
    mockGetTx.mockResolvedValue({ tx: { body: { messages: [{ action: "new-hand", data: `seed=${SEED}` }] } } });
    mockPublicStateAt.mockResolvedValue({ handNumber: 12, players: [1, 2, 3, 4, 5, 6, 7, 8].map(seat => ({ seat, holeCards: ["X", "X"] })) });
});

afterEach(() => jest.restoreAllMocks());

it("is pending and reads nothing while the hand is running", () => {
    const { result } = renderHook(() => useHandVerification({ ...args, phase: "running", enabled: true }));
    expect(result.current.status).toBe("pending");
    expect(result.current.verification).toBeNull();
    expect(mockTxSearch).not.toHaveBeenCalled();
    expect(mockGetTx).not.toHaveBeenCalled();
});

it("reads nothing while the window is closed", () => {
    const { result } = renderHook(() => useHandVerification({ ...args, phase: "ended", enabled: false }));
    expect(result.current.status).toBe("idle");
    expect(mockTxSearch).not.toHaveBeenCalled();
});

it("verifies a finished hand from the chain's records", async () => {
    const { result } = renderHook(() => useHandVerification({ ...args, phase: "ended", enabled: true }));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(mockGetTx).toHaveBeenCalledWith("START");
    expect(mockPublicStateAt).toHaveBeenCalledWith(expect.anything(), "0x85", 962890);
    expect(result.current.startTx).toEqual({ hash: "START", height: 962868 });
    expect(result.current.endHeight).toBe(962890);
    expect(result.current.evidence?.seed).toBe(SEED);
    expect(result.current.verification?.verdict).toBe("verified");
    expect(result.current.verification?.hands[1]).toMatchObject({ seat: 2, cards: ["3S", "KC"], shown: true });
});

it("is unavailable when the hand has no new-hand tx (dealt from chain state)", async () => {
    mockTxSearch.mockImplementation((query: string) =>
        Promise.resolve(query.startsWith("hand_started") ? { result: { txs: [] } } : tx("END", 962890, [handCompleted("", "")]))
    );
    const { result } = renderHook(() => useHandVerification({ ...args, phase: "ended", enabled: true }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(mockGetTx).not.toHaveBeenCalled();
    expect(result.current.verification?.verdict).toBe("unavailable");
});

it("still verifies when the end state already belongs to the next hand", async () => {
    mockPublicStateAt.mockResolvedValue({ handNumber: 13, players: [] });
    const { result } = renderHook(() => useHandVerification({ ...args, phase: "ended", enabled: true }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.evidence?.dealtSeats).toBeNull();
    expect(result.current.verification?.verdict).toBe("verified");
    expect(result.current.verification?.hands.every(h => h.seat === null)).toBe(true);
});

it("reports an error when no node recorded how the hand ended", async () => {
    mockTxSearch.mockResolvedValue({ result: { txs: [] } });
    const { result } = renderHook(() => useHandVerification({ ...args, phase: "ended", enabled: true }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toContain("Hand #12");
});
