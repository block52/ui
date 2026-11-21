import { block52HistoryRpc, isPrunedHeightError, publicStateAtFallingBack } from "./chainHistory";

const BLOCK52 = "https://node1.block52.xyz/rpc/";
const TEXAS = "https://node.texashodl.net/rpc/";
const PRESETS = [
    { name: "Block52", rpc: BLOCK52 },
    { name: "Texas Hodl", rpc: TEXAS }
];

describe("isPrunedHeightError", () => {
    it("recognises a height the node no longer keeps", () => {
        const logged = new Error(
            "failed to load state at height 700000; version mismatch on immutable IAVL tree; version does not exist"
        );
        expect(isPrunedHeightError(logged)).toBe(true);
        expect(isPrunedHeightError(new Error("height 12 is not available, lowest height is 100"))).toBe(true);
    });

    it("leaves a real answer, including a missing game, on the node that gave it", () => {
        expect(isPrunedHeightError(new Error("rpc error: code = NotFound desc = game state with ID 0xabc"))).toBe(false);
        expect(isPrunedHeightError(new Error("offline"))).toBe(false);
        expect(isPrunedHeightError(undefined)).toBe(false);
    });
});

describe("block52HistoryRpc", () => {
    it("points at Block52 only when the selected node is a different mainnet node", () => {
        expect(block52HistoryRpc({ name: "Texas Hodl", rpc: TEXAS }, PRESETS)).toBe(BLOCK52);
        expect(block52HistoryRpc({ name: "Block52", rpc: BLOCK52 }, PRESETS)).toBeUndefined();
        expect(block52HistoryRpc({ name: "Localhost", rpc: "http://localhost:26657" }, PRESETS)).toBeUndefined();
    });
});

describe("publicStateAtFallingBack", () => {
    const state = { handNumber: 4 } as never;

    it("stays on the selected node when that read succeeds", async () => {
        const read = jest.fn(async (rpc: string) => {
            if (rpc !== TEXAS) throw new Error("should not ask Block52");
            return state;
        });
        await expect(publicStateAtFallingBack(read, TEXAS, BLOCK52)).resolves.toBe(state);
        expect(read).toHaveBeenCalledTimes(1);
    });

    it("retries Block52 only after a pruned height", async () => {
        const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
        const read = jest.fn(async (rpc: string) => {
            if (rpc === TEXAS) throw new Error("failed to load state at height 700000; version does not exist");
            return state;
        });
        await expect(publicStateAtFallingBack(read, TEXAS, BLOCK52)).resolves.toBe(state);
        expect(read.mock.calls.map(call => call[0])).toEqual([TEXAS, BLOCK52]);
        error.mockRestore();
    });

    it("does not retry when the selected node answered with something else", async () => {
        const read = jest.fn(async () => {
            throw new Error("rpc error: code = NotFound desc = game state with ID 0xabc");
        });
        await expect(publicStateAtFallingBack(read, TEXAS, BLOCK52)).rejects.toThrow(/NotFound/);
        expect(read).toHaveBeenCalledTimes(1);
    });
});
