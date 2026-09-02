import { LegalActionDTO, NonPlayerActionType, PlayerStatus } from "@block52/poker-vm-sdk";
import { SIT_IN_METHOD_NEXT_BB, SIT_IN_METHOD_POST_NOW } from "../hooks/playerActions";
import {
    getPlayerActionDisplay,
    isBootstrap,
    shouldShowPlayerActionPanel,
    PlayerActionDisplayInput
} from "./playerActionDisplayUtils";

// Helper to build a LegalActionDTO from an action string
const action = (a: NonPlayerActionType | string): LegalActionDTO => ({
    action: a as NonPlayerActionType,
    min: undefined,
    max: undefined,
    index: 0,
});

const base: PlayerActionDisplayInput = {
    playerStatus: null,
    sitInMethod: null,
    legalActions: [],
    totalSeatedPlayers: 0,
    handNumber: 1,
    hasActivePlayers: false,
    // These tests exercise the sit-in method UI, which shows when the toggle is ON.
    // The auto-drive (toggle OFF) default is covered in its own describe block.
    sitInOptions: true,
};

// ===== isBootstrap =====

describe("isBootstrap", () => {
    it("returns true when no active players and handNumber 1", () => {
        expect(isBootstrap(false, 1)).toBe(true);
    });

    it("returns false when active players exist (game in progress)", () => {
        expect(isBootstrap(true, 1)).toBe(false);
    });

    it("returns false after first hand even with no active players", () => {
        expect(isBootstrap(false, 2)).toBe(false);
    });

    it("returns false at hand 5 with no active players", () => {
        expect(isBootstrap(false, 5)).toBe(false);
    });

    it("returns false when active players exist at hand 5", () => {
        expect(isBootstrap(true, 5)).toBe(false);
    });
});

// ===== shouldShowPlayerActionPanel =====

describe("shouldShowPlayerActionPanel", () => {
    it("returns true when pending (SITTING_IN status)", () => {
        expect(shouldShowPlayerActionPanel({
            ...base,
            playerStatus: PlayerStatus.SITTING_IN,
        })).toBe(true);
    });

    it("returns true when waiting-for-players (solo)", () => {
        expect(shouldShowPlayerActionPanel({
            ...base,
            totalSeatedPlayers: 1,
        })).toBe(true);
    });

    it("returns true when sit-in-options available", () => {
        expect(shouldShowPlayerActionPanel({
            ...base,
            legalActions: [action(NonPlayerActionType.SIT_IN)],
            totalSeatedPlayers: 3,
            handNumber: 5,
            hasActivePlayers: true,
        })).toBe(true);
    });

    it("returns true when sit-in-bootstrap (bootstrap)", () => {
        expect(shouldShowPlayerActionPanel({
            ...base,
            legalActions: [action(NonPlayerActionType.SIT_IN)],
            totalSeatedPlayers: 2,
            handNumber: 1,
            hasActivePlayers: false,
        })).toBe(true);
    });

    it("returns false when no relevant actions with 2+ players", () => {
        expect(shouldShowPlayerActionPanel({
            ...base,
            totalSeatedPlayers: 2,
            handNumber: 2,
        })).toBe(false);
    });

    it("returns false when only LEAVE and JOIN with 2+ players", () => {
        expect(shouldShowPlayerActionPanel({
            ...base,
            legalActions: [
                action(NonPlayerActionType.LEAVE),
                action(NonPlayerActionType.JOIN),
            ],
            totalSeatedPlayers: 3,
            handNumber: 2,
        })).toBe(false);
    });
});

// ===== getPlayerActionDisplay =====

describe("getPlayerActionDisplay", () => {
    // --- AC-1: Solo player — waiting-for-players regardless of actions ---

    it("returns waiting-for-players for solo player with SIT_IN action", () => {
        const result = getPlayerActionDisplay({
            ...base,
            legalActions: [action(NonPlayerActionType.SIT_IN)],
            totalSeatedPlayers: 1,
        });
        expect(result).toEqual({ kind: "waiting-for-players" });
    });

    it("returns waiting-for-players for solo player with SIT_IN + SIT_OUT + LEAVE", () => {
        const result = getPlayerActionDisplay({
            ...base,
            legalActions: [
                action(NonPlayerActionType.SIT_IN),
                action(NonPlayerActionType.SIT_OUT),
                action(NonPlayerActionType.LEAVE),
            ],
            totalSeatedPlayers: 1,
        });
        expect(result).toEqual({ kind: "waiting-for-players" });
    });

    it("returns waiting-for-players for solo player with SIT_OUT + LEAVE only", () => {
        const result = getPlayerActionDisplay({
            ...base,
            legalActions: [
                action(NonPlayerActionType.SIT_OUT),
                action(NonPlayerActionType.LEAVE),
            ],
            totalSeatedPlayers: 1,
        });
        expect(result).toEqual({ kind: "waiting-for-players" });
    });

    it("returns waiting-for-players for solo player with LEAVE + JOIN only (no sit actions)", () => {
        const result = getPlayerActionDisplay({
            ...base,
            legalActions: [
                action(NonPlayerActionType.LEAVE),
                action(NonPlayerActionType.JOIN),
            ],
            totalSeatedPlayers: 1,
        });
        expect(result).toEqual({ kind: "waiting-for-players" });
    });

    // --- AC-2: Bootstrap — single explicit "Sit In" when no active players, handNumber 1 ---

    it("returns sit-in-bootstrap for bootstrap: no active players, hand 1, has SIT_IN", () => {
        const result = getPlayerActionDisplay({
            ...base,
            legalActions: [action(NonPlayerActionType.SIT_IN)],
            totalSeatedPlayers: 2,
            handNumber: 1,
            hasActivePlayers: false,
        });
        expect(result).toEqual({ kind: "sit-in-bootstrap" });
    });

    it("returns sit-in-bootstrap for bootstrap with mixed actions (SIT_IN + LEAVE)", () => {
        const result = getPlayerActionDisplay({
            ...base,
            legalActions: [
                action(NonPlayerActionType.SIT_IN),
                action(NonPlayerActionType.SIT_OUT),
                action(NonPlayerActionType.LEAVE),
            ],
            totalSeatedPlayers: 2,
            handNumber: 1,
            hasActivePlayers: false,
        });
        expect(result).toEqual({ kind: "sit-in-bootstrap" });
    });

    // --- Auto-drive: sitInOptions OFF (default) → auto-sit-in instead of a panel ---

    it("returns auto-sit-in when sitInOptions is off (default), running table", () => {
        const result = getPlayerActionDisplay({
            ...base,
            sitInOptions: false,
            legalActions: [action(NonPlayerActionType.SIT_IN), action(NonPlayerActionType.SIT_IN_AND_WAIT)],
            totalSeatedPlayers: 3,
            handNumber: 5,
            hasActivePlayers: true,
        });
        expect(result).toEqual({ kind: "auto-sit-in" });
    });

    it("returns auto-sit-in when sitInOptions is off on an empty table (bootstrap)", () => {
        const result = getPlayerActionDisplay({
            ...base,
            sitInOptions: false,
            legalActions: [action(NonPlayerActionType.SIT_IN)],
            totalSeatedPlayers: 2,
            handNumber: 1,
            hasActivePlayers: false,
        });
        expect(result).toEqual({ kind: "auto-sit-in" });
    });

    it("defaults to auto-sit-in when sitInOptions is omitted", () => {
        const result = getPlayerActionDisplay({
            playerStatus: null,
            sitInMethod: null,
            legalActions: [action(NonPlayerActionType.SIT_IN)],
            totalSeatedPlayers: 3,
            handNumber: 5,
            hasActivePlayers: true,
        });
        expect(result).toEqual({ kind: "auto-sit-in" });
    });

    it("does NOT auto-sit-in a deliberately sat-out player (default toggle) — ui#51", () => {
        // Regression: a SITTING_OUT player keeps a legal SIT_IN so they can return.
        // Auto-driving it would immediately undo their sit-out ("sat me out, then
        // dealt me in"). They must opt back in explicitly → manual sit-in panel.
        const result = getPlayerActionDisplay({
            ...base,
            sitInOptions: false,
            playerStatus: PlayerStatus.SITTING_OUT,
            legalActions: [action(NonPlayerActionType.SIT_IN)],
            totalSeatedPlayers: 2,
            handNumber: 5,
            hasActivePlayers: true,
        });
        expect(result).toEqual({ kind: "sit-in-options" });
    });

    it("returns sit-in-options (NOT auto) when hand > 1", () => {
        const result = getPlayerActionDisplay({
            ...base,
            legalActions: [action(NonPlayerActionType.SIT_IN)],
            totalSeatedPlayers: 2,
            handNumber: 2,
            hasActivePlayers: false,
        });
        expect(result).toEqual({ kind: "sit-in-options" });
    });

    it("returns sit-in-options (NOT auto) when active players exist even at hand 1", () => {
        const result = getPlayerActionDisplay({
            ...base,
            legalActions: [action(NonPlayerActionType.SIT_IN)],
            totalSeatedPlayers: 3,
            handNumber: 1,
            hasActivePlayers: true,
        });
        expect(result).toEqual({ kind: "sit-in-options" });
    });

    // --- BUG FIX: 2nd player joins while 1st is ACTIVE during hand 1 ---

    it("returns sit-in-options (NOT auto) when joining table with active player during hand 1", () => {
        const result = getPlayerActionDisplay({
            ...base,
            legalActions: [action(NonPlayerActionType.SIT_IN)],
            totalSeatedPlayers: 2,
            handNumber: 1,
            hasActivePlayers: true,
        });
        expect(result).toEqual({ kind: "sit-in-options" });
    });

    // --- 3+ players: sit-in options shown ---

    it("returns sit-in-options when 3+ players seated (running game)", () => {
        const result = getPlayerActionDisplay({
            ...base,
            legalActions: [
                action(NonPlayerActionType.SIT_IN),
                action(NonPlayerActionType.LEAVE),
            ],
            totalSeatedPlayers: 3,
            handNumber: 5,
            hasActivePlayers: true,
        });
        expect(result).toEqual({ kind: "sit-in-options" });
    });

    it("returns sit-in-options for player returning from SITTING_OUT with mixed actions", () => {
        const result = getPlayerActionDisplay({
            ...base,
            playerStatus: PlayerStatus.SITTING_OUT,
            legalActions: [
                action(NonPlayerActionType.SIT_IN),
                action(NonPlayerActionType.SIT_OUT),
                action(NonPlayerActionType.LEAVE),
            ],
            totalSeatedPlayers: 4,
            handNumber: 10,
            hasActivePlayers: true,
        });
        expect(result).toEqual({ kind: "sit-in-options" });
    });

    it("returns sit-in-options even when DEAL and NEW_HAND are present", () => {
        const result = getPlayerActionDisplay({
            ...base,
            legalActions: [
                action(NonPlayerActionType.SIT_IN),
                action(NonPlayerActionType.DEAL),
                action(NonPlayerActionType.NEW_HAND),
                action(NonPlayerActionType.LEAVE),
            ],
            totalSeatedPlayers: 3,
            handNumber: 3,
            hasActivePlayers: true,
        });
        expect(result).toEqual({ kind: "sit-in-options" });
    });

    // --- 2+ players: sit-out button when no SIT_IN ---

    it("returns sit-out-button with SIT_OUT + LEAVE (no SIT_IN) and 2+ players", () => {
        const result = getPlayerActionDisplay({
            ...base,
            legalActions: [
                action(NonPlayerActionType.SIT_OUT),
                action(NonPlayerActionType.LEAVE),
            ],
            totalSeatedPlayers: 3,
            handNumber: 2,
        });
        expect(result).toEqual({ kind: "sit-out-button" });
    });

    // --- Pending state (takes priority over everything) ---

    it("returns pending with next-bb message when method is next-bb", () => {
        const result = getPlayerActionDisplay({
            ...base,
            playerStatus: PlayerStatus.SITTING_IN,
            sitInMethod: SIT_IN_METHOD_NEXT_BB,
        });
        expect(result).toEqual({ kind: "pending", waitingMessage: "Waiting For Next Big Blind..." });
    });

    it("returns pending with sit-in message when method is post-now", () => {
        const result = getPlayerActionDisplay({
            ...base,
            playerStatus: PlayerStatus.SITTING_IN,
            sitInMethod: SIT_IN_METHOD_POST_NOW,
        });
        expect(result).toEqual({ kind: "pending", waitingMessage: "Waiting to sit in..." });
    });

    it("returns pending with default sit-in message when method is null", () => {
        const result = getPlayerActionDisplay({
            ...base,
            playerStatus: PlayerStatus.SITTING_IN,
            sitInMethod: null,
        });
        expect(result).toEqual({ kind: "pending", waitingMessage: "Waiting to sit in..." });
    });

    it("returns pending even if legalActions contains SIT_IN", () => {
        const result = getPlayerActionDisplay({
            ...base,
            playerStatus: PlayerStatus.SITTING_IN,
            legalActions: [action(NonPlayerActionType.SIT_IN)],
            totalSeatedPlayers: 5,
            handNumber: 3,
        });
        expect(result.kind).toBe("pending");
    });

    it("returns pending for solo player in SITTING_IN status", () => {
        const result = getPlayerActionDisplay({
            ...base,
            playerStatus: PlayerStatus.SITTING_IN,
            sitInMethod: SIT_IN_METHOD_NEXT_BB,
            totalSeatedPlayers: 1,
        });
        expect(result).toEqual({ kind: "pending", waitingMessage: "Waiting For Next Big Blind..." });
    });

    // --- Waiting for big blind (#2139/#545) ---

    it("returns pending with next-bb message for WAITING_FOR_BIG_BLIND status", () => {
        const result = getPlayerActionDisplay({
            ...base,
            playerStatus: PlayerStatus.WAITING_FOR_BIG_BLIND,
            totalSeatedPlayers: 5,
            handNumber: 3,
        });
        expect(result).toEqual({ kind: "pending", waitingMessage: "Waiting For Next Big Blind...", showSeatOption: true });
    });

    it("returns pending for WAITING_FOR_BIG_BLIND regardless of legalActions", () => {
        // A waiting entrant only ever gets TOP_UP/LEAVE, but even if SIT_IN/SIT_OUT
        // leaked in, the waiting status must still win — never the sit-in options.
        const result = getPlayerActionDisplay({
            ...base,
            playerStatus: PlayerStatus.WAITING_FOR_BIG_BLIND,
            legalActions: [action(NonPlayerActionType.SIT_IN), action(NonPlayerActionType.SIT_OUT)],
            totalSeatedPlayers: 5,
            handNumber: 3,
        });
        expect(result.kind).toBe("pending");
    });

    // --- No actions ---

    it("returns waiting-for-players when no actions and no players", () => {
        const result = getPlayerActionDisplay(base);
        expect(result).toEqual({ kind: "waiting-for-players" });
    });

    it("returns none when no sit actions and 2+ players", () => {
        const result = getPlayerActionDisplay({
            ...base,
            totalSeatedPlayers: 2,
            handNumber: 2,
        });
        expect(result).toEqual({ kind: "none" });
    });

    it("returns none when only LEAVE and JOIN present with 2+ players", () => {
        const result = getPlayerActionDisplay({
            ...base,
            legalActions: [
                action(NonPlayerActionType.LEAVE),
                action(NonPlayerActionType.JOIN),
            ],
            totalSeatedPlayers: 3,
            handNumber: 2,
        });
        expect(result).toEqual({ kind: "none" });
    });
});
