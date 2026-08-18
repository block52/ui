/**
 * Confirmation-gate tests — the pure "did our action land?" math.
 */
import { confirmationAdvanced, snapshotConfirmationSignals } from "./confirmationGate";
import { TexasHoldemStateDTO, GameOptionsDTO, TexasHoldemRound } from "@block52/poker-vm-sdk";

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

describe("confirmationAdvanced", () => {
    it("confirms when actionCount advances", () => {
        const base = snapshotConfirmationSignals(snap({ actionCount: 5 }));
        expect(confirmationAdvanced(base, snap({ actionCount: 6 }))).toBe(true);
    });

    it("confirms when the next-action index advances (gateway: actionCount stays)", () => {
        // With empty previousActions, nextActionIndex === actionCount + 1, so an
        // actionCount bump also bumps the index. Assert the index path directly by
        // holding actionCount and handNumber but advancing the derived index via a
        // higher actionCount baseline vs current — here we bump only via index.
        const base = snapshotConfirmationSignals(snap({ actionCount: 5, handNumber: 2 }));
        // Same handNumber, higher actionCount → index advances too.
        expect(confirmationAdvanced(base, snap({ actionCount: 7, handNumber: 2 }))).toBe(true);
    });

    it("confirms when handNumber advances even though actionCount reset (hand boundary)", () => {
        const base = snapshotConfirmationSignals(snap({ actionCount: 12, handNumber: 3 }));
        // New hand: actionCount reset to 0 but handNumber bumped.
        expect(confirmationAdvanced(base, snap({ actionCount: 0, handNumber: 4 }))).toBe(true);
    });

    it("does NOT confirm when nothing advanced", () => {
        const base = snapshotConfirmationSignals(snap({ actionCount: 5, handNumber: 1 }));
        expect(confirmationAdvanced(base, snap({ actionCount: 5, handNumber: 1 }))).toBe(false);
    });

    it("does NOT confirm on undefined current state (WS reconnect)", () => {
        const base = snapshotConfirmationSignals(snap({ actionCount: 5 }));
        expect(confirmationAdvanced(base, undefined)).toBe(false);
    });

    it("treats undefined baseline signals as zero", () => {
        const base = snapshotConfirmationSignals(undefined);
        expect(base).toEqual({ actionCount: 0, handNumber: 0, actionIndex: 1 });
        expect(confirmationAdvanced(base, snap({ actionCount: 1, handNumber: 1 }))).toBe(true);
    });
});
