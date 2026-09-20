/**
 * Confirmation-baseline tests — where a job was when it executed. The identity
 * match itself is tested in identity.test.ts (ui#609).
 */
import { snapshotConfirmationSignals } from "./confirmationGate";
import { ActionDTO, GameOptionsDTO, PlayerActionType, TexasHoldemRound, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";

const options: GameOptionsDTO = {
    minBuyIn: "1000000",
    maxBuyIn: "1000000000",
    minPlayers: 2,
    maxPlayers: 9,
    smallBlind: "500000",
    bigBlind: "1000000",
    timeout: 30000
};

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

describe("snapshotConfirmationSignals", () => {
    it("captures the counters and the next action index from the snapshot", () => {
        expect(snapshotConfirmationSignals(snap({ actionCount: 5, handNumber: 2 }))).toEqual({ actionCount: 5, handNumber: 2, actionIndex: 6 });
    });

    it("derives the next index from the last recorded action when there are any", () => {
        const previousActions: ActionDTO[] = [
            { playerId: "b521x", seat: 1, action: PlayerActionType.CHECK, amount: "0", round: TexasHoldemRound.PREFLOP, index: 41, timestamp: 0 }
        ];
        expect(snapshotConfirmationSignals(snap({ actionCount: 3, previousActions })).actionIndex).toBe(42);
    });

    it("treats an undefined snapshot as the empty table", () => {
        expect(snapshotConfirmationSignals(undefined)).toEqual({ actionCount: 0, handNumber: 0, actionIndex: 1 });
    });
});
