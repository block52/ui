import React, { useEffect } from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { NetworkProvider } from "./NetworkContext";
import { GameStateProvider } from "./GameStateContext";
import { useGameData } from "./gameState/GameDataContext";
import { useGameUI } from "./gameState/GameUIContext";
import { useGameActions } from "./gameState/GameActionsContext";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { TexasHoldemStateDTO, GameOptionsDTO } from "@block52/poker-vm-sdk";

// The provider constructs a WebSocket; hand-roll a mock so tests can drive
// scripted frames into ws.onmessage without a real socket.
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    static instances: MockWebSocket[] = [];

    url: string;
    readyState = MockWebSocket.CONNECTING;
    onopen: (() => void) | null = null;
    onmessage: ((ev: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    sent: string[] = [];

    constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
    }

    send(data: string): void {
        this.sent.push(data);
    }

    close(): void {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.();
    }

    /** Test helper: deliver a frame to the provider's onmessage handler. */
    emit(frame: unknown): void {
        this.onmessage?.({ data: JSON.stringify(frame) });
    }

    /** Test helper: deliver a raw (unparseable) string. */
    emitRaw(data: string): void {
        this.onmessage?.({ data });
    }
}

const TABLE_ID = "0xcafe0001";

const validGameOptions: GameOptionsDTO = {
    minBuyIn: "1000000",
    maxBuyIn: "1000000000",
    minPlayers: 2,
    maxPlayers: 9,
    smallBlind: "500000",
    bigBlind: "1000000",
    timeout: 30000
};

function makeSnapshot(handNumber: number): TexasHoldemStateDTO {
    return {
        gameOptions: validGameOptions,
        players: [],
        communityCards: [],
        deck: "",
        pots: [],
        totalPot: "0",
        nextToAct: 0,
        previousActions: [],
        actionCount: handNumber,
        handNumber,
        round: "preflop" as TexasHoldemStateDTO["round"],
        winners: [],
        results: [],
        legalActions: [],
        availableSeats: [],
        signature: ""
    };
}

function stateFrame(handNumber: number): unknown {
    return {
        event: "state",
        gameId: TABLE_ID,
        data: { format: "cash", variant: "texas-holdem", gameState: makeSnapshot(handNumber) }
    };
}

const Consumer: React.FC = () => {
    const { gameState } = useGameData();
    const { error, validationError, pendingAction } = useGameUI();
    const { subscribeToTable } = useGameActions();

    useEffect(() => {
        subscribeToTable(TABLE_ID);
    }, [subscribeToTable]);

    return (
        <div>
            <span data-testid="hand">{gameState?.handNumber ?? "none"}</span>
            <span data-testid="error">{error?.message ?? "none"}</span>
            <span data-testid="validation">{validationError?.message ?? "none"}</span>
            <span data-testid="pending">{pendingAction?.action ?? "none"}</span>
        </div>
    );
};

function renderProvider() {
    return render(
        <NetworkProvider>
            <GameStateProvider>
                <Consumer />
            </GameStateProvider>
        </NetworkProvider>
    );
}

function currentSocket(): MockWebSocket {
    const socket = MockWebSocket.instances[MockWebSocket.instances.length - 1];
    if (!socket) throw new Error("no socket created");
    return socket;
}

describe("GameStateProvider ingest funnel", () => {
    let originalWebSocket: typeof WebSocket;

    beforeEach(() => {
        originalWebSocket = global.WebSocket;
        // @ts-expect-error — assigning the hand-rolled mock over the DOM lib type.
        global.WebSocket = MockWebSocket;
        MockWebSocket.instances = [];
        localStorage.clear();
        localStorage.setItem(STORAGE_KEYS.cosmosAddress, "b521testaddress");
    });

    afterEach(() => {
        global.WebSocket = originalWebSocket;
        delete window.__B52_BUS__;
    });

    it("commits ordered snapshots through the bus", async () => {
        renderProvider();
        const socket = currentSocket();

        act(() => {
            socket.emit(stateFrame(1));
            socket.emit(stateFrame(2));
            socket.emit(stateFrame(3));
        });

        await waitFor(() => expect(screen.getByTestId("hand").textContent).toBe("3"));

        // The dev introspection handle records strictly-increasing commit seqs.
        const bus = window.__B52_BUS__;
        expect(bus).toBeDefined();
        expect(bus!.commitLog.map(e => e.seq)).toEqual([1, 2, 3]);
        expect(bus!.committed).toBe(3);
    });

    it("surfaces an error frame", async () => {
        renderProvider();
        const socket = currentSocket();

        act(() => {
            socket.emit({ type: "error", message: "kaboom" });
        });

        await waitFor(() => expect(screen.getByTestId("error").textContent).toBe("kaboom"));
    });

    it("surfaces a GAME_NOT_FOUND error and clears the game state", async () => {
        renderProvider();
        const socket = currentSocket();

        act(() => {
            socket.emit(stateFrame(5));
        });
        await waitFor(() => expect(screen.getByTestId("hand").textContent).toBe("5"));

        act(() => {
            socket.emit({ type: "error", code: "GAME_NOT_FOUND", message: "Game not found", details: { suggestion: "Create it" } });
        });

        await waitFor(() => expect(screen.getByTestId("error").textContent).toBe("Game not found\n\nCreate it"));
        expect(screen.getByTestId("hand").textContent).toBe("none");
    });

    it("surfaces a pending action", async () => {
        renderProvider();
        const socket = currentSocket();

        act(() => {
            socket.emit({ event: "pending", gameId: TABLE_ID, data: { actor: "0xabc", action: "call", amount: "1000000" } });
        });

        await waitFor(() => expect(screen.getByTestId("pending").textContent).toBe("call"));
    });

    it("surfaces a validation error while still rendering the snapshot", async () => {
        renderProvider();
        const socket = currentSocket();

        act(() => {
            // Missing format/variant → validation error, snapshot still committed.
            socket.emit({ event: "state", gameId: TABLE_ID, data: { gameState: makeSnapshot(7) } });
        });

        await waitFor(() => expect(screen.getByTestId("hand").textContent).toBe("7"));
        expect(screen.getByTestId("validation").textContent).toContain("Missing required fields");
    });

    it("counts an unparseable frame and keeps the table up instead of raising a page error (ui#623)", async () => {
        const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
        renderProvider();
        const socket = currentSocket();

        act(() => {
            socket.emit(stateFrame(4));
        });
        await waitFor(() => expect(screen.getByTestId("hand").textContent).toBe("4"));

        act(() => {
            socket.emitRaw("not-json{{{");
        });

        // Counted on the dev handle, logged, and the last good state stays on
        // screen — never swapped for the error page.
        await waitFor(() => expect(window.__B52_BUS__?.parseFailures).toBe(1));
        expect(screen.getByTestId("error").textContent).toBe("none");
        expect(screen.getByTestId("hand").textContent).toBe("4");
        expect(window.__B52_BUS__?.committed).toBe(1);
        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("Dropped 1 unparseable WebSocket document"), expect.any(String));
        consoleError.mockRestore();
    });

    it("ingests every document of a newline-batched frame, in order (pokerchain#364 tolerance)", async () => {
        renderProvider();
        const socket = currentSocket();

        act(() => {
            socket.emitRaw(`${JSON.stringify(stateFrame(1))}\n${JSON.stringify(stateFrame(2))}\n`);
        });

        await waitFor(() => expect(screen.getByTestId("hand").textContent).toBe("2"));
        const bus = window.__B52_BUS__;
        expect(bus!.commitLog.map(e => e.seq)).toEqual([1, 2]);
        expect(bus!.parseFailures).toBe(0);
        expect(screen.getByTestId("error").textContent).toBe("none");
    });

    it("keeps the good documents of a frame that also carries a malformed line", async () => {
        jest.spyOn(console, "error").mockImplementation(() => {});
        renderProvider();
        const socket = currentSocket();

        act(() => {
            socket.emitRaw(`${JSON.stringify(stateFrame(1))}\ngarbage\n${JSON.stringify(stateFrame(2))}`);
        });

        await waitFor(() => expect(screen.getByTestId("hand").textContent).toBe("2"));
        expect(window.__B52_BUS__?.parseFailures).toBe(1);
        expect(window.__B52_BUS__?.committed).toBe(2);
        expect(screen.getByTestId("error").textContent).toBe("none");
        jest.restoreAllMocks();
    });

    it("ignores frames for a different table", async () => {
        renderProvider();
        const socket = currentSocket();

        act(() => {
            socket.emit({ event: "state", gameId: "0xdifferent", data: { format: "cash", variant: "texas-holdem", gameState: makeSnapshot(9) } });
        });

        // Give the async drain a chance to run — nothing should commit.
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(screen.getByTestId("hand").textContent).toBe("none");
    });
});
