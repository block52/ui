import { PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import type { ContributionSnapshot } from "./handContribution";
import { countDealtHands, formatHandsPlayed, handsPlayedReadFailed, playerWasDealtIn, type DealtHandLog } from "./handsPlayed";

const PLAYER = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";

const log = (actions: ContributionSnapshot["previousActions"], winners: ContributionSnapshot["winners"] = []): ContributionSnapshot => ({
    previousActions: actions,
    winners
});

const dealt = (key: string, snapshot: ContributionSnapshot | null | undefined): DealtHandLog => ({ key, snapshot });

describe("playerWasDealtIn", () => {
    it("counts a blind, a fold, a check, and a win, on any street", () => {
        expect(playerWasDealtIn(log([{ playerId: PLAYER, action: PlayerActionType.BIG_BLIND, round: TexasHoldemRound.ANTE }]), PLAYER)).toBe(true);
        expect(playerWasDealtIn(log([{ playerId: PLAYER, action: PlayerActionType.FOLD, round: TexasHoldemRound.PREFLOP }]), PLAYER)).toBe(true);
        expect(playerWasDealtIn(log([{ playerId: PLAYER, action: PlayerActionType.CHECK, round: TexasHoldemRound.FLOP }]), PLAYER)).toBe(true);
        expect(
            playerWasDealtIn(log([{ playerId: "b521other", action: PlayerActionType.FOLD }], [{ address: PLAYER.toUpperCase(), amount: "400" }]), PLAYER)
        ).toBe(true);
    });

    it("does not count sitting out, joining, leaving, or a log the node no longer has", () => {
        expect(playerWasDealtIn(log([{ playerId: PLAYER, action: "sit-out" }]), PLAYER)).toBe(false);
        expect(
            playerWasDealtIn(
                log([
                    { playerId: PLAYER, action: "join" },
                    { playerId: PLAYER, action: "leave" }
                ]),
                PLAYER
            )
        ).toBe(false);
        expect(playerWasDealtIn(log([{ playerId: "b521other", action: PlayerActionType.BET, amount: "100" }]), PLAYER)).toBe(false);
        expect(playerWasDealtIn(null, PLAYER)).toBe(false);
        expect(playerWasDealtIn(undefined, PLAYER)).toBe(false);
        expect(playerWasDealtIn(log([{ playerId: PLAYER, action: PlayerActionType.FOLD }]), "")).toBe(false);
        expect(playerWasDealtIn(log([{ playerId: PLAYER, action: PlayerActionType.FOLD }]), undefined)).toBe(false);
    });
});

describe("countDealtHands", () => {
    it("counts each dealt hand once, across cash, sit & go, and tournament tables", () => {
        const hands = [
            dealt("cash#2", log([{ playerId: PLAYER, action: PlayerActionType.CALL }])),
            dealt("cash#2", log([{ playerId: PLAYER, action: PlayerActionType.RAISE }])),
            dealt("sng#1", log([{ playerId: PLAYER, action: PlayerActionType.FOLD }])),
            dealt("tournament#9", log([{ playerId: "b521other", action: PlayerActionType.BET }], [{ address: PLAYER }])),
            dealt("cash#3", log([{ playerId: PLAYER, action: "sit-out" }])),
            dealt("cash#4", null),
            dealt("", log([{ playerId: PLAYER, action: PlayerActionType.CHECK }]))
        ];
        expect(countDealtHands(hands, PLAYER)).toBe(3);
        expect(countDealtHands(hands, undefined)).toBe(0);
    });
});

describe("formatHandsPlayed", () => {
    it("shows an ellipsis while the chain count loads, and never the indexer figure", () => {
        expect(formatHandsPlayed({ pending: true, failed: false, dealt: 12, indexerHands: 68 })).toBe("…");
        expect(formatHandsPlayed({ pending: true, failed: true, dealt: 0, indexerHands: 68 })).toBe("…");
    });

    it("shows the chain count once the read finishes, including zero", () => {
        expect(formatHandsPlayed({ pending: false, failed: false, dealt: 489, indexerHands: 68 })).toBe("489");
        expect(formatHandsPlayed({ pending: false, failed: false, dealt: 1535, indexerHands: 38 })).toBe("1,535");
        expect(formatHandsPlayed({ pending: false, failed: false, dealt: 0, indexerHands: 68 })).toBe("0");
    });

    it("falls back to the indexer total when the chain read fails, and an em dash when that is missing", () => {
        expect(formatHandsPlayed({ pending: false, failed: true, dealt: 0, indexerHands: 68 })).toBe("68");
        expect(formatHandsPlayed({ pending: false, failed: true, dealt: 0 })).toBe("—");
        expect(formatHandsPlayed({ pending: false, failed: true, dealt: 0, indexerHands: Number.NaN })).toBe("—");
    });
});

describe("handsPlayedReadFailed", () => {
    it("fails when the hand list errors or every requested log is gone", () => {
        expect(handsPlayedReadFailed(true, 0, 0, 0)).toBe(true);
        expect(handsPlayedReadFailed(false, 535, 0, 535)).toBe(true);
        expect(handsPlayedReadFailed(false, 535, 0, 600)).toBe(true);
    });

    it("keeps a partial chain count, and a genuine zero", () => {
        expect(handsPlayedReadFailed(false, 535, 489, 46)).toBe(false);
        expect(handsPlayedReadFailed(false, 3, 1, 2)).toBe(false);
        expect(handsPlayedReadFailed(false, 0, 0, 0)).toBe(false);
        expect(handsPlayedReadFailed(false, Number.NaN, 0, 0)).toBe(true);
    });
});
