import {
    getTableStatusMessages,
    getWaitingForPlayerLabel,
    hasTableStatusMessages,
    TableStatusDisplayInput,
} from "./tableStatusDisplayUtils";

const base: TableStatusDisplayInput = {
    currentUserSeat: -1,
    nextToActSeat: null,
    isGameInProgress: false,
    isCurrentUserTurn: false,
    hasLegalActions: false,
    totalActivePlayers: 0,
    isSitAndGoWaitingForPlayers: false,
};

// ===== getWaitingForPlayerLabel =====

describe("getWaitingForPlayerLabel", () => {
    it("returns 'Small Blind' when seat matches smallBlindPosition", () => {
        expect(getWaitingForPlayerLabel(5, { smallBlindPosition: 5 })).toBe("Small Blind");
    });

    it("returns 'Big Blind' when seat matches bigBlindPosition", () => {
        expect(getWaitingForPlayerLabel(3, { bigBlindPosition: 3 })).toBe("Big Blind");
    });

    it("returns 'Dealer' when seat matches dealerPosition", () => {
        expect(getWaitingForPlayerLabel(3, { dealerPosition: 3 })).toBe("Dealer");
    });

    it("returns generic label when seat matches no position", () => {
        expect(getWaitingForPlayerLabel(7, { smallBlindPosition: 1, bigBlindPosition: 2, dealerPosition: 0 })).toBe("player at seat 7");
    });

    it("returns generic label for all seats when no positions provided", () => {
        expect(getWaitingForPlayerLabel(1)).toBe("player at seat 1");
        expect(getWaitingForPlayerLabel(2)).toBe("player at seat 2");
        expect(getWaitingForPlayerLabel(5)).toBe("player at seat 5");
    });

    it("prefers Dealer over Small Blind when both match same seat", () => {
        expect(getWaitingForPlayerLabel(1, { dealerPosition: 1, smallBlindPosition: 1 })).toBe("Dealer");
    });
});

// ===== hasTableStatusMessages =====

describe("hasTableStatusMessages", () => {
    it("returns false for default (unseated, no game)", () => {
        expect(hasTableStatusMessages(base)).toBe(false);
    });

    it("returns true when user is seated", () => {
        expect(hasTableStatusMessages({ ...base, currentUserSeat: 3 })).toBe(true);
    });

    it("returns true when it is your turn", () => {
        expect(hasTableStatusMessages({
            ...base,
            nextToActSeat: 1,
            isGameInProgress: true,
            isCurrentUserTurn: true,
            hasLegalActions: true,
        })).toBe(true);
    });

    it("returns true when hand is complete with 2+ players", () => {
        expect(hasTableStatusMessages({
            ...base,
            totalActivePlayers: 3,
        })).toBe(true);
    });
});

// ===== Seat label =====

describe("getTableStatusMessages — seat label", () => {
    it("shows seat label for seat 0 (edge case)", () => {
        const msgs = getTableStatusMessages({ ...base, currentUserSeat: 0 });
        expect(msgs).toContainEqual({
            kind: "seat-label",
            seatNumber: 0,
            text: "You are seated at position 0",
        });
    });

    it("shows seat label for seat 3", () => {
        const msgs = getTableStatusMessages({ ...base, currentUserSeat: 3 });
        expect(msgs).toContainEqual({
            kind: "seat-label",
            seatNumber: 3,
            text: "You are seated at position 3",
        });
    });

    it("does not show seat label when not seated (seat -1)", () => {
        const msgs = getTableStatusMessages({ ...base, currentUserSeat: -1 });
        const seatMsgs = msgs.filter(m => m.kind === "seat-label");
        expect(seatMsgs).toHaveLength(0);
    });

    it("includes seat number in text", () => {
        const msgs = getTableStatusMessages({ ...base, currentUserSeat: 5 });
        const seatMsg = msgs.find(m => m.kind === "seat-label");
        expect(seatMsg?.text).toContain("5");
    });
});

// ===== Your turn =====

describe("getTableStatusMessages — your turn", () => {
    // --- Happy path ---

    it("shows your-turn when it is your turn with legal actions", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 3,
            isGameInProgress: true,
            isCurrentUserTurn: true,
            hasLegalActions: true,
        });
        expect(msgs).toContainEqual({ kind: "your-turn", text: "Your turn to act!" });
    });

    it("has exact text 'Your turn to act!'", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 1,
            isGameInProgress: true,
            isCurrentUserTurn: true,
            hasLegalActions: true,
        });
        const turnMsg = msgs.find(m => m.kind === "your-turn");
        expect(turnMsg).toBeDefined();
        expect(turnMsg!.text).toBe("Your turn to act!");
    });

    it("shows your-turn at seat 0 (truthiness edge case)", () => {
        const msgs = getTableStatusMessages({
            ...base,
            currentUserSeat: 0,
            nextToActSeat: 0,
            isGameInProgress: true,
            isCurrentUserTurn: true,
            hasLegalActions: true,
        });
        expect(msgs).toContainEqual({ kind: "your-turn", text: "Your turn to act!" });
    });

    // --- Conditions that suppress your-turn ---

    it("does not show your-turn when no legal actions", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 3,
            isGameInProgress: true,
            isCurrentUserTurn: true,
            hasLegalActions: false,
        });
        const turnMsgs = msgs.filter(m => m.kind === "your-turn");
        expect(turnMsgs).toHaveLength(0);
    });

    it("does not show your-turn when it is not your turn", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 3,
            isGameInProgress: true,
            isCurrentUserTurn: false,
            hasLegalActions: true,
        });
        const turnMsgs = msgs.filter(m => m.kind === "your-turn");
        expect(turnMsgs).toHaveLength(0);
    });

    it("does not show your-turn when game is not in progress", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 3,
            isGameInProgress: false,
            isCurrentUserTurn: true,
            hasLegalActions: true,
        });
        const turnMsgs = msgs.filter(m => m.kind === "your-turn");
        expect(turnMsgs).toHaveLength(0);
    });

    it("does not show your-turn when nextToActSeat is null", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: null,
            isGameInProgress: true,
            isCurrentUserTurn: true,
            hasLegalActions: true,
        });
        const turnMsgs = msgs.filter(m => m.kind === "your-turn");
        expect(turnMsgs).toHaveLength(0);
    });

    // --- Mutual exclusivity: your-turn vs waiting-for-player ---

    it("shows your-turn NOT waiting-for-player when it is your turn", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 3,
            isGameInProgress: true,
            isCurrentUserTurn: true,
            hasLegalActions: true,
        });
        expect(msgs.some(m => m.kind === "your-turn")).toBe(true);
        expect(msgs.some(m => m.kind === "waiting-for-player")).toBe(false);
    });

    it("shows waiting-for-player NOT your-turn when it is not your turn", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 5,
            isGameInProgress: true,
            isCurrentUserTurn: false,
            hasLegalActions: false,
        });
        expect(msgs.some(m => m.kind === "waiting-for-player")).toBe(true);
        expect(msgs.some(m => m.kind === "your-turn")).toBe(false);
    });

    it("falls back to waiting-for-player when your turn but no legal actions", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 3,
            isGameInProgress: true,
            isCurrentUserTurn: true,
            hasLegalActions: false,
        });
        expect(msgs.some(m => m.kind === "waiting-for-player")).toBe(true);
        expect(msgs.some(m => m.kind === "your-turn")).toBe(false);
    });

    // --- Realistic game scenarios ---

    it("seated player sees seat-label + your-turn during active hand", () => {
        const msgs = getTableStatusMessages({
            ...base,
            currentUserSeat: 2,
            nextToActSeat: 2,
            isGameInProgress: true,
            isCurrentUserTurn: true,
            hasLegalActions: true,
            totalActivePlayers: 4,
        });
        expect(msgs).toHaveLength(2);
        expect(msgs[0]).toEqual({ kind: "seat-label", seatNumber: 2, text: "You are seated at position 2" });
        expect(msgs[1]).toEqual({ kind: "your-turn", text: "Your turn to act!" });
    });

    it("seated player sees seat-label + waiting-for-player when opponent acts", () => {
        const msgs = getTableStatusMessages({
            ...base,
            currentUserSeat: 2,
            nextToActSeat: 5,
            isGameInProgress: true,
            isCurrentUserTurn: false,
            hasLegalActions: false,
            totalActivePlayers: 6,
            smallBlindPosition: 1,
            bigBlindPosition: 2,
            dealerPosition: 0,
        });
        expect(msgs).toHaveLength(2);
        expect(msgs[0].kind).toBe("seat-label");
        expect(msgs[1]).toEqual({ kind: "waiting-for-player", seatNumber: 5, text: "Waiting for player at seat 5 to act" });
    });

    it("heads-up: your turn at seat 0 with 2 active players", () => {
        const msgs = getTableStatusMessages({
            ...base,
            currentUserSeat: 0,
            nextToActSeat: 0,
            isGameInProgress: true,
            isCurrentUserTurn: true,
            hasLegalActions: true,
            totalActivePlayers: 2,
        });
        const turnMsg = msgs.find(m => m.kind === "your-turn");
        expect(turnMsg).toBeDefined();
        expect(turnMsg!.text).toBe("Your turn to act!");
    });

    it("does not show your-turn between hands even with legal actions", () => {
        const msgs = getTableStatusMessages({
            ...base,
            currentUserSeat: 1,
            nextToActSeat: 1,
            isGameInProgress: false,
            isCurrentUserTurn: true,
            hasLegalActions: true,
            totalActivePlayers: 3,
        });
        expect(msgs.some(m => m.kind === "your-turn")).toBe(false);
        expect(msgs.some(m => m.kind === "waiting-for-player")).toBe(false);
        expect(msgs.some(m => m.kind === "hand-complete")).toBe(true);
    });
});

// ===== Waiting for player =====

describe("getTableStatusMessages — waiting for player", () => {
    it("shows Small Blind label when seat matches smallBlindPosition", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 1,
            isGameInProgress: true,
            smallBlindPosition: 1,
            bigBlindPosition: 2,
            dealerPosition: 0,
        });
        expect(msgs).toContainEqual({
            kind: "waiting-for-player",
            seatNumber: 1,
            text: "Waiting for Small Blind to act",
        });
    });

    it("shows Big Blind label when seat matches bigBlindPosition", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 2,
            isGameInProgress: true,
            smallBlindPosition: 1,
            bigBlindPosition: 2,
            dealerPosition: 0,
        });
        expect(msgs).toContainEqual({
            kind: "waiting-for-player",
            seatNumber: 2,
            text: "Waiting for Big Blind to act",
        });
    });

    it("shows Dealer label when seat matches dealerPosition", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 0,
            isGameInProgress: true,
            smallBlindPosition: 1,
            bigBlindPosition: 2,
            dealerPosition: 0,
        });
        expect(msgs).toContainEqual({
            kind: "waiting-for-player",
            seatNumber: 0,
            text: "Waiting for Dealer to act",
        });
    });

    it("shows generic label when no positions provided", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 5,
            isGameInProgress: true,
        });
        expect(msgs).toContainEqual({
            kind: "waiting-for-player",
            seatNumber: 5,
            text: "Waiting for player at seat 5 to act",
        });
    });

    it("shows generic label when seat matches no position", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 5,
            isGameInProgress: true,
            smallBlindPosition: 1,
            bigBlindPosition: 2,
            dealerPosition: 0,
        });
        expect(msgs).toContainEqual({
            kind: "waiting-for-player",
            seatNumber: 5,
            text: "Waiting for player at seat 5 to act",
        });
    });

    it("heads-up with rotated positions: SB at seat 7, BB at seat 2", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 7,
            isGameInProgress: true,
            smallBlindPosition: 7,
            bigBlindPosition: 2,
            dealerPosition: 7,
        });
        // Dealer takes priority over SB when same seat
        expect(msgs).toContainEqual({
            kind: "waiting-for-player",
            seatNumber: 7,
            text: "Waiting for Dealer to act",
        });
    });

    it("does not show waiting-for-player when game is not in progress", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 3,
            isGameInProgress: false,
        });
        const waitMsgs = msgs.filter(m => m.kind === "waiting-for-player");
        expect(waitMsgs).toHaveLength(0);
    });

    it("does not show waiting-for-player when nextToActSeat is null", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: null,
            isGameInProgress: true,
        });
        const waitMsgs = msgs.filter(m => m.kind === "waiting-for-player");
        expect(waitMsgs).toHaveLength(0);
    });

    it("handles seat 0 correctly (truthiness bug fix)", () => {
        const msgs = getTableStatusMessages({
            ...base,
            nextToActSeat: 0,
            isGameInProgress: true,
        });
        expect(msgs).toContainEqual({
            kind: "waiting-for-player",
            seatNumber: 0,
            text: "Waiting for player at seat 0 to act",
        });
    });
});

// ===== Hand complete =====

describe("getTableStatusMessages — hand complete", () => {
    it("shows hand-complete between hands with 2+ players", () => {
        const msgs = getTableStatusMessages({
            ...base,
            isGameInProgress: false,
            totalActivePlayers: 3,
        });
        expect(msgs).toContainEqual({
            kind: "hand-complete",
            text: "Hand complete - waiting for next hand",
        });
    });

    it("does not show hand-complete when game is in progress", () => {
        const msgs = getTableStatusMessages({
            ...base,
            isGameInProgress: true,
            totalActivePlayers: 3,
        });
        const handMsgs = msgs.filter(m => m.kind === "hand-complete");
        expect(handMsgs).toHaveLength(0);
    });

    it("does not show hand-complete for solo player", () => {
        const msgs = getTableStatusMessages({
            ...base,
            isGameInProgress: false,
            totalActivePlayers: 1,
        });
        const handMsgs = msgs.filter(m => m.kind === "hand-complete");
        expect(handMsgs).toHaveLength(0);
    });

    it("does not show hand-complete during sit-and-go waiting", () => {
        const msgs = getTableStatusMessages({
            ...base,
            isGameInProgress: false,
            totalActivePlayers: 3,
            isSitAndGoWaitingForPlayers: true,
        });
        const handMsgs = msgs.filter(m => m.kind === "hand-complete");
        expect(handMsgs).toHaveLength(0);
    });

    it("includes correct text", () => {
        const msgs = getTableStatusMessages({
            ...base,
            totalActivePlayers: 2,
        });
        const handMsg = msgs.find(m => m.kind === "hand-complete");
        expect(handMsg?.text).toBe("Hand complete - waiting for next hand");
    });
});

// ===== No "waiting for players" message =====

describe("getTableStatusMessages — no waiting-for-players", () => {
    it("returns empty array for solo unseated player (no waiting-for-players)", () => {
        const msgs = getTableStatusMessages({
            ...base,
            totalActivePlayers: 1,
        });
        expect(msgs).toEqual([]);
    });

    it("returns empty array for empty table (no waiting-for-players)", () => {
        const msgs = getTableStatusMessages({
            ...base,
            totalActivePlayers: 0,
        });
        expect(msgs).toEqual([]);
    });
});

// ===== Multiple messages simultaneously =====

describe("getTableStatusMessages — multiple messages", () => {
    it("returns seat-label + your-turn together", () => {
        const msgs = getTableStatusMessages({
            ...base,
            currentUserSeat: 3,
            nextToActSeat: 3,
            isGameInProgress: true,
            isCurrentUserTurn: true,
            hasLegalActions: true,
        });
        expect(msgs).toHaveLength(2);
        expect(msgs[0].kind).toBe("seat-label");
        expect(msgs[1].kind).toBe("your-turn");
    });

    it("returns seat-label + waiting-for-player together", () => {
        const msgs = getTableStatusMessages({
            ...base,
            currentUserSeat: 1,
            nextToActSeat: 5,
            isGameInProgress: true,
        });
        expect(msgs).toHaveLength(2);
        expect(msgs[0].kind).toBe("seat-label");
        expect(msgs[1].kind).toBe("waiting-for-player");
    });

    it("returns seat-label + hand-complete together", () => {
        const msgs = getTableStatusMessages({
            ...base,
            currentUserSeat: 2,
            totalActivePlayers: 4,
        });
        expect(msgs).toHaveLength(2);
        expect(msgs[0].kind).toBe("seat-label");
        expect(msgs[1].kind).toBe("hand-complete");
    });

    it("returns empty array when not seated, no game, few players", () => {
        const msgs = getTableStatusMessages(base);
        expect(msgs).toEqual([]);
    });
});
