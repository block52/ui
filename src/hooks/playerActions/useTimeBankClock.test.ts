/**
 * useTimeBankClock (ui#19): the alarm clock on the player's own pill.
 */
import { renderHook, act } from "@testing-library/react";
import { NonPlayerActionType } from "@block52/poker-vm-sdk";
import { useTimeBankClock } from "./useTimeBankClock";
import { STORAGE_KEYS } from "../../constants/storageKeys";

const ME = "b521me";
const mockSubmit = jest.fn();
let mockGame: Record<string, unknown>;
let mockLegal: { legalActions: { action: string }[]; isPlayerTurn: boolean };
let mockTimer: { isTimeBankArmed: boolean; isInTimeBank: boolean };
let mockLoadingAction: string | null;

jest.mock("../../context/GameStateContext", () => ({ useGameStateContext: () => mockGame }));
jest.mock("../../context/ActionSubmitContext", () => ({ useActionSubmit: () => ({ submit: mockSubmit, loadingAction: mockLoadingAction }) }));
jest.mock("../../context/NetworkContext", () => ({ useNetwork: () => ({ currentNetwork: { name: "test" } }) }));
jest.mock("./usePlayerLegalActions", () => ({ usePlayerLegalActions: () => mockLegal }));
jest.mock("../player/usePlayerTimer", () => ({ usePlayerTimer: () => mockTimer }));
jest.mock("./timeBank", () => ({ timeBank: jest.fn() }));

const game = (timeBankMs: number, bankLeftMs: number) => ({
    connection: { status: "live", attempt: 0 },
    gameState: {
        gameOptions: { timeBankMs },
        players: [{ seat: 1, address: ME, timeBankRemainingMs: bankLeftMs }]
    }
});

describe("useTimeBankClock", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.setItem(STORAGE_KEYS.cosmosAddress, ME);
        mockGame = game(45_000, 45_000);
        mockLegal = { legalActions: [{ action: NonPlayerActionType.TIME_BANK }], isPlayerTurn: true };
        mockTimer = { isTimeBankArmed: false, isInTimeBank: false };
        mockLoadingAction = null;
    });
    afterEach(() => localStorage.clear());

    it("is ready with the next grant on our turn, and a tap submits time-bank", () => {
        const { result } = renderHook(() => useTimeBankClock("0xtable", 1));
        expect(result.current.state).toBe("ready");
        expect(result.current.seconds).toBe(45);
        act(() => result.current.onUse());
        expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ actionName: NonPlayerActionType.TIME_BANK }));
    });

    it("offers 30s on the second use", () => {
        mockGame = game(45_000, 30_000);
        const { result } = renderHook(() => useTimeBankClock("0xtable", 1));
        expect(result.current.seconds).toBe(30);
    });

    it("glows while the tap is in flight and ignores a second tap", () => {
        mockLoadingAction = NonPlayerActionType.TIME_BANK;
        mockLegal = { legalActions: [], isPlayerTurn: true };
        const { result } = renderHook(() => useTimeBankClock("0xtable", 1));
        expect(result.current.state).toBe("armed");
        act(() => result.current.onUse());
        expect(mockSubmit).not.toHaveBeenCalled();
    });

    it("goes quiet the moment the player acts, even mid-bank (ui#944)", () => {
        mockLoadingAction = "check";
        mockLegal = { legalActions: [], isPlayerTurn: true };
        mockTimer = { isTimeBankArmed: false, isInTimeBank: true };
        const { result } = renderHook(() => useTimeBankClock("0xtable", 1));
        expect(result.current.state).toBe("idle");
    });

    it("rings once the turn clock is spent and the bank runs", () => {
        mockLegal = { legalActions: [], isPlayerTurn: true };
        mockTimer = { isTimeBankArmed: false, isInTimeBank: true };
        const { result } = renderHook(() => useTimeBankClock("0xtable", 1));
        expect(result.current.state).toBe("running");
    });

    it("is dim with an empty bank or off our turn, and hidden without a time bank", () => {
        mockLegal = { legalActions: [], isPlayerTurn: false };
        expect(renderHook(() => useTimeBankClock("0xtable", 1)).result.current.state).toBe("idle");
        mockGame = game(0, 0);
        expect(renderHook(() => useTimeBankClock("0xtable", 1)).result.current.state).toBe("hidden");
    });
});
