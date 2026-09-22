/**
 * ActionSubmitController tests — serialization, dedupe, the evidence-gated
 * transport retry, and honest confirmation (identity on the logical track, the
 * tx-by-hash verdict, `unknown` on timeout). Driven with DI (injected run
 * thunks, getState, lookupTx) and jest fake timers, mirroring src/bus/*.test.ts.
 */
import { ActionSubmitController } from "./ActionSubmitController";
import type { SubmitError, SubmitNotice, TxVerdict } from "./types";
import { STALE_INDEX_MESSAGE } from "../hooks/playerActions/transportAction";
import { ActionDTO, TexasHoldemStateDTO, GameOptionsDTO, PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import type { PlayerActionResult } from "../types";

const ME = "b521me";
const OTHER = "b521other";

const options: GameOptionsDTO = {
    minBuyIn: "1000000",
    maxBuyIn: "1000000000",
    minPlayers: 2,
    maxPlayers: 9,
    smallBlind: "500000",
    bigBlind: "1000000",
    timeout: 30000
};

function action(index: number, over: Partial<ActionDTO> = {}): ActionDTO {
    return { playerId: ME, seat: 1, action: PlayerActionType.CALL, amount: "0", round: TexasHoldemRound.PREFLOP, index, timestamp: index, ...over };
}

function snap(overrides: { actionCount?: number; handNumber?: number; previousActions?: ActionDTO[] } = {}): TexasHoldemStateDTO {
    return {
        gameOptions: options,
        players: [],
        communityCards: [],
        deck: "",
        pots: [],
        totalPot: "0",
        nextToAct: 0,
        previousActions: overrides.previousActions ?? [],
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

/** The base state every test starts from: actionCount 5, no actions → our next index is 6. */
const BASE = snap();
/** A frame in which OUR action landed at index 6 (the baseline). */
const mine = (name: PlayerActionType = PlayerActionType.CALL, index = 6) => snap({ actionCount: 6, previousActions: [action(index, { action: name })] });
/** A frame in which somebody ELSE acted at index 6. */
const theirs = () => snap({ actionCount: 6, previousActions: [action(6, { playerId: OTHER })] });

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
    let state: TexasHoldemStateDTO | undefined = BASE;
    let nowMs = 1000;
    const onError = jest.fn<void, [SubmitError]>();
    const onNotice = jest.fn<void, [SubmitNotice]>();
    const clearSigningCache = jest.fn();
    const lookupTx = jest.fn<Promise<TxVerdict | null>, [string]>().mockResolvedValue(null);
    const controller = new ActionSubmitController({
        getState: () => state,
        getLocalAddress: () => ME,
        onError,
        onNotice,
        clearSigningCache,
        lookupTx,
        now: () => nowMs,
        config: { gateSettleMs: 0, backoffMs: 0, ...configOverride }
    });
    const setState = (s: TexasHoldemStateDTO | undefined) => {
        state = s;
    };
    return {
        controller,
        onError,
        onNotice,
        clearSigningCache,
        lookupTx,
        setState,
        /** A committed frame reaches the controller through the logical track. */
        authoritative: (s: TexasHoldemStateDTO) => {
            setState(s);
            controller.onGameState(s, { optimistic: false });
        },
        /** The relay's mempool projection. */
        projected: (s: TexasHoldemStateDTO) => {
            setState(s);
            controller.onGameState(s, { optimistic: true });
        },
        /** Advance fake timers AND the injected clock together. */
        tick: async (ms: number) => {
            nowMs += ms;
            jest.advanceTimersByTime(ms);
            await flush();
        }
    };
}

describe("ActionSubmitController", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it("dedupes a rapid double-click of the same action", async () => {
        const { controller } = makeController();
        const run = jest.fn().mockResolvedValue(ok());

        controller.submit({ actionName: "fold", run });
        controller.submit({ actionName: "fold", run });
        await flush();

        expect(run).toHaveBeenCalledTimes(1);
        expect(controller.getSnapshot()).toMatchObject({ status: "busy", loadingAction: "fold", queueDepth: 0 });
    });

    it("serializes progression actions — the second waits until the first is settled by evidence", async () => {
        const { controller, authoritative } = makeController();
        const newHandRun = jest.fn().mockResolvedValue(ok("0xnew-hand"));
        const blindRun = jest.fn().mockResolvedValue(ok("0xblind"));

        controller.submit({ actionName: "new-hand", run: newHandRun });
        controller.submit({ actionName: "small-blind", run: blindRun });
        await flush();

        // New hand is submitted; small blind is queued and has NOT run yet.
        expect(newHandRun).toHaveBeenCalledTimes(1);
        expect(blindRun).not.toHaveBeenCalled();
        expect(controller.getSnapshot()).toMatchObject({ loadingAction: "new-hand", queueDepth: 1 });

        // The chain records the new hand → blind dequeues and runs.
        authoritative(snap({ actionCount: 0, handNumber: 2 }));
        await flush();

        expect(blindRun).toHaveBeenCalledTimes(1);
        expect(controller.getSnapshot()).toMatchObject({ loadingAction: "small-blind" });
    });

    it("drops a queued decision when our preceding action advances the table", async () => {
        const { controller, authoritative, onError } = makeController();
        const callRun = jest.fn().mockResolvedValue(ok("0xcall"));
        const foldRun = jest.fn().mockResolvedValue(ok("0xfold"));

        controller.submit({ actionName: "call", run: callRun });
        controller.submit({ actionName: "fold", run: foldRun });
        await flush();

        authoritative(mine(PlayerActionType.CALL));
        await flush();

        expect(callRun).toHaveBeenCalledTimes(1);
        expect(foldRun).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({
            kind: "superseded",
            actionName: "fold",
            message: expect.stringContaining("was not sent")
        }));
        expect(controller.getSnapshot()).toMatchObject({ status: "idle", queueDepth: 0 });
    });

    it("runs a queued decision when its predecessor fails without advancing the table", async () => {
        const { controller, onError } = makeController();
        const failedRun = jest.fn().mockRejectedValue(new Error("insufficient funds"));
        const foldRun = jest.fn().mockResolvedValue(ok("0xfold"));

        controller.submit({ actionName: "call", run: failedRun });
        controller.submit({ actionName: "fold", run: foldRun });
        await flush();

        expect(failedRun).toHaveBeenCalledTimes(1);
        expect(foldRun).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: "terminal", actionName: "call" }));
    });

    it("confirms only OUR recorded action — another player's action at the table does not confirm ours (ui#609)", async () => {
        const { controller, authoritative, onError } = makeController();
        controller.submit({ actionName: "bet", run: jest.fn().mockResolvedValue(ok()) });
        await flush();
        expect(controller.getSnapshot()).toMatchObject({ status: "busy", loadingAction: "bet" });

        // Table progress by somebody else: the old counter gate called this confirmed.
        authoritative(theirs());
        await flush();
        expect(controller.getSnapshot()).toMatchObject({ status: "busy", loadingAction: "bet" });

        // Our bet, recorded after theirs → committed.
        authoritative(snap({ actionCount: 7, previousActions: [action(6, { playerId: OTHER }), action(7, { action: PlayerActionType.BET })] }));
        await flush();
        expect(controller.getSnapshot()).toMatchObject({ status: "idle", loadingAction: null });
        expect(onError).not.toHaveBeenCalled();
    });

    it("releases busy on the relay's projection of our action but does not call it confirmed", async () => {
        const { controller, projected, lookupTx, onError, tick } = makeController();
        controller.submit({ actionName: "call", run: jest.fn().mockResolvedValue(ok("0xcall")) });
        await flush();

        projected(mine());
        await flush();
        expect(controller.getSnapshot().status).toBe("idle"); // accepted: the next action may go

        // The chain then rejects the tx at execution: still surfaced, because
        // "accepted" was never "committed".
        lookupTx.mockResolvedValueOnce({ hash: "0xcall", code: 5, rawLog: "insufficient funds", height: 10 });
        await tick(2000);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: "rejected", actionName: "call", hash: "0xcall", message: expect.stringContaining("insufficient funds") }));
    });

    it("settles when evidence arrives while the broadcast is still in flight", async () => {
        // Regression: evidence on the logical track can land before run() resolves.
        // If we only watched once "submitted", busy would strand until the timer.
        const { controller, authoritative } = makeController();
        let resolveRun: (v: PlayerActionResult) => void = () => {};
        const run = jest.fn(() => new Promise<PlayerActionResult>(resolve => (resolveRun = resolve)));

        controller.submit({ actionName: "call", run });
        await flush();
        expect(controller.getSnapshot().status).toBe("busy"); // awaiting run()

        authoritative(mine());
        await flush();
        expect(controller.getSnapshot().status).toBe("idle");

        // The late broadcast resolution is a harmless no-op.
        resolveRun(ok());
        await flush();
        expect(controller.getSnapshot().status).toBe("idle");
    });

    it("on the confirm timeout releases busy as UNKNOWN, tells the user, and never calls it confirmed", async () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const { controller, onNotice, onError, lookupTx, tick } = makeController();
        controller.submit({ actionName: "call", run: jest.fn().mockResolvedValue(ok("0xcall")) });
        await flush();
        expect(controller.getSnapshot().status).toBe("busy");

        await tick(8000);
        expect(controller.getSnapshot().status).toBe("idle");
        expect(onNotice).toHaveBeenCalledWith(expect.objectContaining({ kind: "unknown", actionName: "call", hash: "0xcall" }));
        expect(onError).not.toHaveBeenCalled();

        // A late verdict is NOT discarded as moot: the user hears their call failed.
        lookupTx.mockResolvedValueOnce({ hash: "0xcall", code: 32, rawLog: "not your turn", height: 11 });
        await tick(2000);
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: "rejected", message: expect.stringContaining("not your turn") }));
        warn.mockRestore();
    });

    it("commits on a tx verdict of code 0 without any frame, and stops polling", async () => {
        const { controller, lookupTx, tick } = makeController();
        controller.submit({ actionName: "check", run: jest.fn().mockResolvedValue(ok("0xcheck")) });
        await flush();

        lookupTx.mockResolvedValueOnce({ hash: "0xcheck", code: 0, rawLog: "", height: 12 });
        await tick(2000);
        expect(controller.getSnapshot().status).toBe("idle");
        expect(lookupTx).toHaveBeenCalledTimes(1);

        await tick(10_000);
        expect(lookupTx).toHaveBeenCalledTimes(1); // final: no more polling
    });

    it("fails as SUPERSEDED when the chain recorded a different action of ours at our turn", async () => {
        // The action clock folded us before our call landed: our call can never execute.
        const { controller, authoritative, onError } = makeController();
        controller.submit({ actionName: "call", run: jest.fn().mockResolvedValue(ok()) });
        await flush();

        authoritative(mine(PlayerActionType.FOLD));
        await flush();
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: "superseded", actionName: "call", message: expect.stringContaining('"fold"') }));
        expect(controller.getSnapshot().status).toBe("idle");
    });

    it("does not supersede on a mempool projection — only committed state can", async () => {
        const { controller, projected, onError } = makeController();
        controller.submit({ actionName: "call", run: jest.fn().mockResolvedValue(ok()) });
        await flush();

        projected(mine(PlayerActionType.FOLD));
        await flush();
        expect(onError).not.toHaveBeenCalled();
        expect(controller.getSnapshot().status).toBe("busy");
    });

    it("confirms a new-hand structurally when the hand number advances", async () => {
        const { controller, authoritative } = makeController();
        controller.submit({ actionName: "new-hand", run: jest.fn().mockResolvedValue(ok()) });
        await flush();
        authoritative(snap({ actionCount: 0, handNumber: 2 }));
        await flush();
        expect(controller.getSnapshot().status).toBe("idle");
    });

    it("does NOT re-broadcast a transport error when the evidence shows it already landed", async () => {
        const { controller, clearSigningCache, setState, onError } = makeController();
        const run = jest.fn().mockImplementationOnce(async () => {
            // The action actually landed; the socket died reading the response.
            setState(mine(PlayerActionType.RAISE));
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
        // Second attempt succeeded → submitted (busy) until evidence arrives.
        expect(controller.getSnapshot()).toMatchObject({ status: "busy", loadingAction: "check" });
    });

    it("never retries a stale-index error and surfaces it", async () => {
        const { controller, clearSigningCache, onError } = makeController();
        const run = jest.fn().mockRejectedValue(new Error(STALE_INDEX_MESSAGE));

        controller.submit({ actionName: "call", run });
        await flush();

        expect(run).toHaveBeenCalledTimes(1);
        expect(clearSigningCache).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: "stale", message: STALE_INDEX_MESSAGE, actionName: "call" }));
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

    it("stops polling for a verdict after the verdict window", async () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const { controller, lookupTx, tick } = makeController({ verdictPollMs: 2000, verdictTimeoutMs: 6000 });
        controller.submit({ actionName: "call", run: jest.fn().mockResolvedValue(ok("0xcall")) });
        await flush();

        await tick(2000);
        await tick(2000);
        await tick(2000); // 6 s elapsed → the window closes after this poll
        await tick(10_000);
        expect(lookupTx).toHaveBeenCalledTimes(3);
        warn.mockRestore();
    });

    it("reset abandons every job and cancels every timer — no late toasts", async () => {
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const { controller, onNotice, onError, lookupTx, tick } = makeController();
        controller.submit({ actionName: "call", run: jest.fn().mockResolvedValue(ok("0xcall")) });
        await flush();
        controller.reset();
        lookupTx.mockResolvedValue({ hash: "0xcall", code: 5, rawLog: "late", height: 1 });
        await tick(20_000);
        expect(onNotice).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(controller.getSnapshot().status).toBe("idle");
        warn.mockRestore();
    });
});

describe("ActionSubmitController connection gate (ui#613)", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    function makeGated(live: () => boolean) {
        const onError = jest.fn<void, [SubmitError]>();
        const run = jest.fn().mockResolvedValue(ok());
        const controller = new ActionSubmitController({
            getState: () => snap(),
            getLocalAddress: () => ME,
            onError,
            clearSigningCache: jest.fn(),
            isConnected: live,
            now: () => 1000
        });
        return { controller, onError, run };
    }

    it("refuses to broadcast while the game-state socket is not live, and says so", async () => {
        const { controller, onError, run } = makeGated(() => false);
        controller.submit({ actionName: "call", run });
        await flush();
        expect(run).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ kind: "offline", actionName: "call" }));
        expect(controller.getSnapshot()).toMatchObject({ status: "idle", queueDepth: 0 });
        expect(controller.getSnapshot().lastError?.kind).toBe("offline");
    });

    it("broadcasts normally once the socket is live again", async () => {
        let live = false;
        const { controller, onError, run } = makeGated(() => live);
        controller.submit({ actionName: "call", run });
        await flush();
        expect(run).not.toHaveBeenCalled();

        live = true;
        controller.submit({ actionName: "call", run });
        await flush();
        expect(run).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1); // only the refused one
    });
});
