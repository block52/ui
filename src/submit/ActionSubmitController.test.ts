/**
 * ActionSubmitController tests — serialization, dedupe, the gated transport
 * retry, and confirmation (signal + 8s timeout). Driven with DI (injected run
 * thunks + getState) and jest fake timers, mirroring src/bus/*.test.ts.
 */
import { ActionSubmitController } from "./ActionSubmitController";
import type { SubmitError } from "./types";
import { STALE_INDEX_MESSAGE } from "../hooks/playerActions/transportAction";
import { TexasHoldemStateDTO, GameOptionsDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";
import type { PlayerActionResult } from "../types";

const options: GameOptionsDTO = {
    minBuyIn: "1000000",
    maxBuyIn: "1000000000",
    minPlayers: 2,
    maxPlayers: 9,
    smallBlind: "500000",
    bigBlind: "1000000",
    timeout: 30000
};

function snap(overrides: { actionCount?: number; handNumber?: number } = {}): TexasHoldemStateDTO {
    return {
        gameOptions: options,
        players: [],
        communityCards: [],
        deck: "",
        pots: [],
        totalPot: "0",
        nextToAct: 0,
        previousActions: [],
        actionCount: overrides.actionCount ?? 5,
        handNumber: overrides.handNumber ?? 1,
        round: TexasHoldemRound.PREFLOP,
        winners: [],
        results: [],
        legalActions: [],
        availableSeats: [],
        signature: ""
    };
}

function ok(hash = "0xhash"): PlayerActionResult {
    return { hash, gameId: "0xtable", action: "fold", amount: "0" };
}

/** Flush pending microtasks (Promise.resolve chains) — not faked by jest timers. */
async function flush(): Promise<void> {
    for (let i = 0; i < 20; i++) {
        await Promise.resolve();
    }
}

function makeController(configOverride: Record<string, number> = {}) {
    let state: TexasHoldemStateDTO | undefined = snap({ actionCount: 5, handNumber: 1 });
    let nowMs = 1000;
    const onError = jest.fn<void, [SubmitError]>();
    const clearSigningCache = jest.fn();
    const controller = new ActionSubmitController({
        getState: () => state,
        onError,
        clearSigningCache,
        now: () => nowMs,
        config: { gateSettleMs: 0, backoffMs: 0, ...configOverride }
    });
    return {
        controller,
        onError,
        clearSigningCache,
        setState: (s: TexasHoldemStateDTO | undefined) => {
            state = s;
        },
        advanceNow: (d: number) => {
            nowMs += d;
        }
    };
}

describe("ActionSubmitController", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it("dedupes a rapid double-click of the same action", async () => {
        const { controller } = makeController();
        const run = jest.fn().mockResolvedValue(ok());

        controller.submit({ actionName: "fold", run });
        controller.submit({ actionName: "fold", run });
        await flush();

        expect(run).toHaveBeenCalledTimes(1);
        expect(controller.getSnapshot()).toMatchObject({ status: "busy", loadingAction: "fold" });
    });

    it("serializes distinct actions — the second waits until the first confirms", async () => {
        const { controller, setState } = makeController();
        const foldRun = jest.fn().mockResolvedValue(ok("0xfold"));
        const callRun = jest.fn().mockResolvedValue(ok("0xcall"));

        controller.submit({ actionName: "fold", run: foldRun });
        controller.submit({ actionName: "call", run: callRun });
        await flush();

        // Fold is confirming; call is queued and has NOT run yet.
        expect(foldRun).toHaveBeenCalledTimes(1);
        expect(callRun).not.toHaveBeenCalled();
        expect(controller.getSnapshot()).toMatchObject({ loadingAction: "fold", queueDepth: 1 });

        // Fold confirms → call dequeues and runs.
        setState(snap({ actionCount: 6 }));
        controller.onGameState(snap({ actionCount: 6 }));
        await flush();

        expect(callRun).toHaveBeenCalledTimes(1);
        expect(controller.getSnapshot()).toMatchObject({ loadingAction: "call" });
    });

    it("clears busy when a confirmation signal advances", async () => {
        const { controller } = makeController();
        controller.submit({ actionName: "bet", run: jest.fn().mockResolvedValue(ok()) });
        await flush();
        expect(controller.getSnapshot()).toMatchObject({ status: "busy", loadingAction: "bet" });

        controller.onGameState(snap({ actionCount: 6 }));
        await flush();
        expect(controller.getSnapshot()).toMatchObject({ status: "idle", loadingAction: null });
    });

    it("clears busy via the 8s escape-hatch timeout when no confirmation arrives", async () => {
        const { controller } = makeController();
        controller.submit({ actionName: "call", run: jest.fn().mockResolvedValue(ok()) });
        await flush();
        expect(controller.getSnapshot().status).toBe("busy");

        jest.advanceTimersByTime(8000);
        await flush();
        expect(controller.getSnapshot().status).toBe("idle");
    });

    it("does NOT re-broadcast a transport error when the gate shows it already landed", async () => {
        const { controller, clearSigningCache, setState, onError } = makeController();
        const run = jest.fn().mockImplementationOnce(async () => {
            // The action actually landed; the socket died reading the response.
            setState(snap({ actionCount: 6 }));
            throw new Error("socket hang up");
        });

        controller.submit({ actionName: "raise", run });
        await flush();

        expect(run).toHaveBeenCalledTimes(1); // no re-broadcast
        expect(clearSigningCache).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(controller.getSnapshot().status).toBe("idle");
    });

    it("retries a transport error once (clearing the signing cache) then fails", async () => {
        const { controller, clearSigningCache, onError } = makeController();
        const run = jest.fn().mockRejectedValue(new Error("fetch failed"));

        controller.submit({ actionName: "fold", run });
        await flush();

        expect(run).toHaveBeenCalledTimes(2); // original + one retry
        expect(clearSigningCache).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: "transport", actionName: "fold" }));
        expect(controller.getSnapshot().status).toBe("idle");
    });

    it("recovers when the transport retry succeeds", async () => {
        const { controller, clearSigningCache, onError } = makeController();
        const run = jest
            .fn()
            .mockRejectedValueOnce(new Error("ECONNRESET"))
            .mockResolvedValueOnce(ok());

        controller.submit({ actionName: "check", run });
        await flush();

        expect(run).toHaveBeenCalledTimes(2);
        expect(clearSigningCache).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
        // Second attempt succeeded → confirming (busy) until a signal advances.
        expect(controller.getSnapshot()).toMatchObject({ status: "busy", loadingAction: "check" });
    });

    it("never retries a stale-index error and surfaces it", async () => {
        const { controller, clearSigningCache, onError } = makeController();
        const run = jest.fn().mockRejectedValue(new Error(STALE_INDEX_MESSAGE));

        controller.submit({ actionName: "call", run });
        await flush();

        expect(run).toHaveBeenCalledTimes(1);
        expect(clearSigningCache).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "stale", message: STALE_INDEX_MESSAGE, actionName: "call" })
        );
        expect(controller.getSnapshot().status).toBe("idle");
    });

    it("never retries a terminal error and surfaces it", async () => {
        const { controller, clearSigningCache, onError } = makeController();
        const run = jest.fn().mockRejectedValue(new Error("insufficient funds"));

        controller.submit({ actionName: "bet", run });
        await flush();

        expect(run).toHaveBeenCalledTimes(1);
        expect(clearSigningCache).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: "terminal", actionName: "bet" }));
    });

    it("drops a submit when the queue is already full", async () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const { controller } = makeController();
        controller.submit({ actionName: "fold", run: jest.fn().mockResolvedValue(ok()) });
        controller.submit({ actionName: "call", run: jest.fn().mockResolvedValue(ok()) });
        const raiseRun = jest.fn().mockResolvedValue(ok());
        controller.submit({ actionName: "raise", run: raiseRun });
        await flush();

        expect(raiseRun).not.toHaveBeenCalled();
        expect(controller.getSnapshot().queueDepth).toBe(1);
        warn.mockRestore();
    });

    it("dedupes the same action within the dedupe window after it settles", async () => {
        const { controller, onError } = makeController({ dedupeWindowMs: 350 });
        const run = jest.fn().mockRejectedValue(new Error(STALE_INDEX_MESSAGE));

        controller.submit({ actionName: "fold", run });
        await flush();
        expect(run).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);

        // Immediate re-submit (now unchanged) is inside the window → dropped.
        controller.submit({ actionName: "fold", run });
        await flush();
        expect(run).toHaveBeenCalledTimes(1);
    });
});
