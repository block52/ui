import { getTxWithBackoff, GET_TX_BUDGET_MS, GET_TX_RETRY_DELAYS_MS } from "./getTxWithBackoff";

/** A fake clock: `sleep` advances `now` instead of waiting. */
const fakeClock = () => {
    let time = 0;
    const slept: number[] = [];
    return {
        slept,
        now: () => time,
        sleep: async (ms: number) => {
            slept.push(ms);
            time += ms;
        },
        advance: (ms: number) => {
            time += ms;
        }
    };
};

describe("getTxWithBackoff", () => {
    it("returns on the first attempt without sleeping when the tx is already indexed", async () => {
        const clock = fakeClock();
        const getTx = jest.fn().mockResolvedValue({ tx_response: { code: 0 } });

        const tx = await getTxWithBackoff(getTx, "HASH", clock.sleep, clock.now);

        expect(tx).toEqual({ tx_response: { code: 0 } });
        expect(getTx).toHaveBeenCalledTimes(1);
        expect(getTx).toHaveBeenCalledWith("HASH");
        expect(clock.slept).toEqual([]);
    });

    it("retries with backoff until the indexer has the tx", async () => {
        const clock = fakeClock();
        const getTx = jest
            .fn()
            .mockRejectedValueOnce(new Error("404"))
            .mockRejectedValueOnce(new Error("404"))
            .mockResolvedValue({ tx_response: { code: 0 } });

        const tx = await getTxWithBackoff(getTx, "HASH", clock.sleep, clock.now);

        expect(tx).toEqual({ tx_response: { code: 0 } });
        expect(getTx).toHaveBeenCalledTimes(3);
        expect(clock.slept).toEqual([200, 500]);
    });

    it("resolves null after every attempt fails, within the budget", async () => {
        const clock = fakeClock();
        const getTx = jest.fn().mockRejectedValue(new Error("404"));

        const tx = await getTxWithBackoff(getTx, "HASH", clock.sleep, clock.now);

        expect(tx).toBeNull();
        expect(getTx).toHaveBeenCalledTimes(GET_TX_RETRY_DELAYS_MS.length);
        expect(clock.now()).toBeLessThanOrEqual(GET_TX_BUDGET_MS);
    });

    it("stops early when slow lookups would push the next wait past the budget", async () => {
        const clock = fakeClock();
        const getTx = jest.fn().mockImplementation(async () => {
            clock.advance(2000);
            throw new Error("timeout");
        });

        const tx = await getTxWithBackoff(getTx, "HASH", clock.sleep, clock.now);

        expect(tx).toBeNull();
        // lookup (t=2000) → +200 → lookup (4200) → +500 → lookup (6700); +1000 would pass 5000
        expect(getTx).toHaveBeenCalledTimes(3);
        expect(clock.slept).toEqual([200, 500]);
    });
});
