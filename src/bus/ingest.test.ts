import { classifyMessage, RawWsMessage } from "./ingest";
import { TexasHoldemStateDTO, GameOptionsDTO } from "@block52/poker-vm-sdk";

const TABLE_ID = "0xcafe0001";
const OTHER_TABLE = "0xdeadbeef";

const validGameOptions: GameOptionsDTO = {
    minBuyIn: "1000000",
    maxBuyIn: "1000000000",
    minPlayers: 2,
    maxPlayers: 9,
    smallBlind: "500000",
    bigBlind: "1000000",
    timeout: 30000
};

function makeSnapshot(overrides: Partial<TexasHoldemStateDTO> = {}): TexasHoldemStateDTO {
    return {
        gameOptions: validGameOptions,
        players: [],
        communityCards: [],
        deck: "",
        pots: [],
        totalPot: "0",
        nextToAct: 0,
        previousActions: [],
        actionCount: 0,
        handNumber: 1,
        round: "preflop" as TexasHoldemStateDTO["round"],
        winners: [],
        results: [],
        legalActions: [],
        availableSeats: [],
        signature: "",
        ...overrides
    };
}

/** Canonical cosmos state message shape. */
function cosmosMessage(event: string, gameId: string, snapshot: TexasHoldemStateDTO | undefined): RawWsMessage {
    return {
        event,
        gameId,
        data: {
            format: "cash",
            variant: "texas-holdem",
            gameState: snapshot
        }
    };
}

describe("classifyMessage", () => {
    describe("gateway state frames", () => {
        it("normalizes and classifies a gateway `state` frame as a valid state", () => {
            const snapshot = makeSnapshot();
            const gatewayFrame: RawWsMessage = {
                type: "state",
                gameId: TABLE_ID,
                state: {
                    gameId: TABLE_ID,
                    format: "cash",
                    variant: "texas-holdem",
                    gameState: snapshot
                }
            };

            const result = classifyMessage(gatewayFrame, TABLE_ID);

            expect(result.kind).toBe("state");
            if (result.kind !== "state") throw new Error("unreachable");
            expect(result.snapshot).toEqual(snapshot);
            expect(result.format).toBe("cash");
            expect(result.variant).toBe("texas-holdem");
            expect(result.validationError).toBeNull();
        });

        it("ignores a gateway `subscribed` ack frame", () => {
            expect(classifyMessage({ type: "subscribed", gameId: TABLE_ID }, TABLE_ID)).toEqual({ kind: "ignore" });
        });
    });

    describe("cosmos state-bearing events", () => {
        it.each(["state", "player_joined_game", "action_performed", "game_created"])(
            "classifies cosmos `%s` as a valid state",
            event => {
                const snapshot = makeSnapshot();
                const result = classifyMessage(cosmosMessage(event, TABLE_ID, snapshot), TABLE_ID);

                expect(result.kind).toBe("state");
                if (result.kind !== "state") throw new Error("unreachable");
                expect(result.snapshot).toEqual(snapshot);
                expect(result.format).toBe("cash");
                expect(result.variant).toBe("texas-holdem");
                expect(result.validationError).toBeNull();
            }
        );

        it("ignores a state event for a different table", () => {
            const snapshot = makeSnapshot();
            expect(classifyMessage(cosmosMessage("state", OTHER_TABLE, snapshot), TABLE_ID)).toEqual({ kind: "ignore" });
        });
    });

    describe("old PVM gameStateUpdate", () => {
        it("classifies a gameStateUpdate for this table as a valid state", () => {
            const snapshot = makeSnapshot();
            const frame: RawWsMessage = {
                type: "gameStateUpdate",
                tableAddress: TABLE_ID,
                data: { format: "cash", variant: "texas-holdem", gameState: snapshot }
            };

            const result = classifyMessage(frame, TABLE_ID);
            expect(result.kind).toBe("state");
            if (result.kind !== "state") throw new Error("unreachable");
            expect(result.snapshot).toEqual(snapshot);
        });

        it("ignores a gameStateUpdate for a different table", () => {
            const snapshot = makeSnapshot();
            const frame: RawWsMessage = {
                type: "gameStateUpdate",
                tableAddress: OTHER_TABLE,
                data: { format: "cash", variant: "texas-holdem", gameState: snapshot }
            };
            expect(classifyMessage(frame, TABLE_ID)).toEqual({ kind: "ignore" });
        });
    });

    describe("validation failures (Commandment 7 — never defaulted)", () => {
        it("flags a state event with no gameState and commits nothing", () => {
            const frame: RawWsMessage = { event: "state", gameId: TABLE_ID, data: { format: "cash", variant: "texas-holdem" } };
            const result = classifyMessage(frame, TABLE_ID);

            expect(result.kind).toBe("validationErrorNoState");
            if (result.kind !== "validationErrorNoState") throw new Error("unreachable");
            expect(result.validationError.missingFields).toEqual(["gameState"]);
        });

        it("commits the snapshot but surfaces a validation error when format/variant are missing", () => {
            const snapshot = makeSnapshot();
            const frame: RawWsMessage = {
                event: "state",
                gameId: TABLE_ID,
                data: { gameState: snapshot }
            };

            const result = classifyMessage(frame, TABLE_ID);
            expect(result.kind).toBe("state");
            if (result.kind !== "state") throw new Error("unreachable");
            expect(result.snapshot).toEqual(snapshot);
            expect(result.validationError).not.toBeNull();
            expect(result.validationError?.missingFields).toEqual(expect.arrayContaining(["format", "variant"]));
            // No defaults: format/variant coerce to undefined, never a fake value.
            expect(result.format).toBeUndefined();
            expect(result.variant).toBeUndefined();
        });

        it("surfaces a validation error when gameOptions fields are missing", () => {
            const snapshot = makeSnapshot({ gameOptions: { ...validGameOptions, smallBlind: "" } });
            const frame = cosmosMessage("state", TABLE_ID, snapshot);
            const result = classifyMessage(frame, TABLE_ID);

            expect(result.kind).toBe("state");
            if (result.kind !== "state") throw new Error("unreachable");
            expect(result.validationError?.missingFields).toContain("gameOptions.smallBlind");
        });
    });

    describe("pending", () => {
        it("classifies a pending frame into a PendingAction", () => {
            const frame: RawWsMessage = {
                event: "pending",
                gameId: TABLE_ID,
                data: { gameId: TABLE_ID, actor: "0xabc", action: "call", amount: "1000000" }
            };

            const result = classifyMessage(frame, TABLE_ID);
            expect(result.kind).toBe("pending");
            if (result.kind !== "pending") throw new Error("unreachable");
            expect(result.pendingAction.actor).toBe("0xabc");
            expect(result.pendingAction.action).toBe("call");
            expect(result.pendingAction.amount).toBe("1000000");
            expect(result.pendingAction.gameId).toBe(TABLE_ID);
            expect(typeof result.pendingAction.timestamp).toBe("number");
        });

        it("ignores a pending frame with no data", () => {
            expect(classifyMessage({ event: "pending", gameId: TABLE_ID }, TABLE_ID)).toEqual({ kind: "ignore" });
        });
    });

    describe("action_accepted", () => {
        it("classifies an action_accepted ack", () => {
            expect(classifyMessage({ event: "action_accepted", gameId: TABLE_ID }, TABLE_ID)).toEqual({ kind: "actionAccepted" });
        });
    });

    describe("errors", () => {
        it("classifies a generic error frame (type: error)", () => {
            const result = classifyMessage({ type: "error", message: "boom" }, TABLE_ID);
            expect(result.kind).toBe("error");
            if (result.kind !== "error") throw new Error("unreachable");
            expect(result.error.message).toBe("boom");
            expect(result.clearGameState).toBe(false);
        });

        it("classifies a generic error frame (event: error)", () => {
            const result = classifyMessage({ event: "error", message: "kaboom" }, TABLE_ID);
            expect(result.kind).toBe("error");
            if (result.kind !== "error") throw new Error("unreachable");
            expect(result.error.message).toBe("kaboom");
        });

        it("falls back to a default message when none is provided", () => {
            const result = classifyMessage({ type: "error" }, TABLE_ID);
            expect(result.kind).toBe("error");
            if (result.kind !== "error") throw new Error("unreachable");
            expect(result.error.message).toBe("An error occurred");
        });

        it("formats GAME_NOT_FOUND with its suggestion and requests game-state clear", () => {
            const result = classifyMessage(
                { type: "error", code: "GAME_NOT_FOUND", message: "Game not found", details: { suggestion: "Create it first" } },
                TABLE_ID
            );
            expect(result.kind).toBe("error");
            if (result.kind !== "error") throw new Error("unreachable");
            expect(result.error.message).toBe("Game not found\n\nCreate it first");
            expect(result.clearGameState).toBe(true);
        });

        it("handles GAME_NOT_FOUND without a suggestion", () => {
            const result = classifyMessage({ event: "error", code: "GAME_NOT_FOUND", message: "Game not found" }, TABLE_ID);
            expect(result.kind).toBe("error");
            if (result.kind !== "error") throw new Error("unreachable");
            expect(result.error.message).toBe("Game not found");
            expect(result.clearGameState).toBe(true);
        });
    });

    describe("ignored frames", () => {
        it("ignores unknown message types", () => {
            expect(classifyMessage({ type: "somethingElse" }, TABLE_ID)).toEqual({ kind: "ignore" });
        });

        it("ignores null / non-object input", () => {
            expect(classifyMessage(null, TABLE_ID)).toEqual({ kind: "ignore" });
            expect(classifyMessage(undefined, TABLE_ID)).toEqual({ kind: "ignore" });
        });
    });
});
