import { PlayerActionType, PlayerStatus, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import type { PlayerHand } from "../types/players";
import {
    byHandRecency,
    cardsForHistoryHand,
    displayBoard,
    historyCountLabel,
    mergeHistoryHands,
    playerHandFromState,
    unlistedHands,
    viewerPlayedHand,
    wonAmountFromSnapshots
} from "./handHistoryCards";

const state = {
    handNumber: 11,
    communityCards: ["AH", "KD", "7C"],
    winners: [{ address: "winner", amount: "600" }],
    previousActions: [
        { playerId: "hero", seat: 1, action: "post-small-blind" },
        { playerId: "hero", seat: 1, action: "fold" }
    ],
    players: [
        { seat: 1, address: "hero", status: PlayerStatus.FOLDED, holeCards: ["X", "X"] },
        { seat: 2, address: "winner", status: PlayerStatus.SHOWING, holeCards: ["AS", "AD"] },
        { seat: 3, address: "called", status: PlayerStatus.ALL_IN, holeCards: ["KS", "KC"] },
        { seat: 4, address: "mucked", status: PlayerStatus.MUCKED, holeCards: ["QS", "QC"] },
        { seat: 5, address: "busted", status: PlayerStatus.BUSTED, holeCards: ["7H", "2C"] }
    ]
} as unknown as TexasHoldemStateDTO;

describe("hand history cards", () => {
    it("treats blinds, folds and wins as playing, and sit-out or deal as not", () => {
        expect(viewerPlayedHand(state, "HERO")).toBe(true);
        expect(viewerPlayedHand(state, "winner")).toBe(true);
        expect(viewerPlayedHand({
            ...state,
            winners: [],
            previousActions: [{ playerId: "idle", seat: 3, action: "sit-out" }]
        } as unknown as TexasHoldemStateDTO, "idle")).toBe(false);
        expect(viewerPlayedHand({
            ...state,
            winners: [],
            previousActions: [{ playerId: "dealer", seat: 1, action: PlayerActionType.SHOW }]
        } as unknown as TexasHoldemStateDTO, "dealer")).toBe(true);
    });

    it("shows the viewer's cards, showdown and all-in hands, and hides mucked cards", () => {
        const shown = cardsForHistoryHand({
            ...state,
            previousActions: [
                { playerId: "busted", action: PlayerActionType.ALL_IN },
                { playerId: "hero", action: "fold" }
            ],
            players: [
                { seat: 1, address: "hero", status: PlayerStatus.FOLDED, holeCards: ["QH", "QD"] },
                { seat: 2, address: "winner", status: PlayerStatus.SHOWING, holeCards: ["AS", "AD"] },
                { seat: 3, address: "called", status: PlayerStatus.ALL_IN, holeCards: ["KS", "KC"] },
                { seat: 4, address: "mucked", status: PlayerStatus.MUCKED, holeCards: ["QS", "QC"] },
                { seat: 5, address: "busted", status: PlayerStatus.BUSTED, holeCards: ["7H", "2C"] }
            ]
        } as unknown as TexasHoldemStateDTO, "hero");
        expect(shown.board).toEqual(["AH", "KD", "7C"]);
        expect(shown.seats.map(seat => [seat.yours ? "you" : seat.seat, seat.cards])).toEqual([
            ["you", ["QH", "QD"]],
            [2, ["AS", "AD"]],
            [3, ["KS", "KC"]],
            [5, ["7H", "2C"]]
        ]);
    });

    it("does not invent the viewer's cards when the public state still has them masked", () => {
        const shown = cardsForHistoryHand(state, "hero");
        expect(shown.seats.some(seat => seat.yours)).toBe(false);
        expect(shown.seats.find(seat => seat.seat === 4)).toBeUndefined();
    });

    it("builds an indexer-shaped row only when the wallet played", () => {
        expect(playerHandFromState("0xabc", state, "hero", 566662)).toMatchObject({
            game_id: "0xabc",
            hand_number: 11,
            seat: 1,
            status: "folded",
            won_amount: 0,
            block_height: 566662,
            community_cards: ["AH", "KD", "7C"]
        });
        expect(playerHandFromState("0xabc", state, "idle", 1)).toBeNull();
    });

    it("lists table hands the wallet's indexer page does not already have", () => {
        const listed = [{ game_id: "0xa", hand_number: 2 }];
        const game = [
            { game_id: "0xa", hand_number: 2 },
            { game_id: "0xa", hand_number: 1 },
            { game_id: "0xb", hand_number: 1 }
        ];
        expect(unlistedHands(listed, game).map(hand => hand.hand_number)).toEqual([1, 1]);
    });

    it("sorts newer blocks and then higher hand numbers first", () => {
        const rows = [
            { block_height: 10, hand_number: 1 },
            { block_height: 12, hand_number: 2 },
            { block_height: 12, hand_number: 4 }
        ];
        expect([...rows].sort(byHandRecency).map(row => row.hand_number)).toEqual([4, 2, 1]);
    });

    it("keeps the longer board and counts recovered hands past the indexer total", () => {
        expect(displayBoard(["ah", "kd"], ["AH", "KD", "7C"])).toEqual(["AH", "KD", "7C"]);
        expect(displayBoard(["AH", "KD", "7C", "2S"], ["AH", "KD"])).toEqual(["AH", "KD", "7C", "2S"]);
        const indexed = [{ ...handRow(2), block_height: 20 }];
        const recovered = [handRow(1), handRow(2)];
        expect(mergeHistoryHands(indexed, recovered).map(row => row.hand_number)).toEqual([2, 1]);
        expect(historyCountLabel(2, 2)).toBe("Showing 2 of 2");
        expect(historyCountLabel(3, 2)).toBe("Showing 3");
    });
});

const handRow = (hand_number: number): PlayerHand => ({
    game_id: "0xa",
    hand_number,
    seat: 1,
    status: "folded",
    won_amount: 0,
    block_height: 10,
    community_cards: [],
    winner_count: 0
});

describe("wonAmountFromSnapshots", () => {
    const hero = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";

    it("uses winners[] when the end snapshot still has them", () => {
        expect(wonAmountFromSnapshots(hero, {
            winners: [{ address: hero, amount: "600" }, { address: "other", amount: "100" }],
            previousActions: [{ playerId: hero, action: "call", amount: "200" }],
            players: [{ address: hero, stack: "0" }]
        })).toBe(600);
        expect(wonAmountFromSnapshots(hero, {
            winners: [{ address: "other", amount: "900" }],
            previousActions: [{ playerId: hero, action: "fold", amount: "" }],
            players: [{ address: hero, stack: "5000" }]
        })).toBe(0);
    });

    it("derives the pot share from the next hand's starting stack when winners[] is empty", () => {
        // 14 Nov MTT hand 39: shoved 1445, next hand stack 3190.
        expect(wonAmountFromSnapshots(hero, {
            winners: [],
            previousActions: [{ playerId: hero, action: "all-in", amount: "1445" }],
            players: [{ address: hero, stack: "0", sumOfBets: "1445" }]
        }, {
            players: [{ address: hero, stack: "3190", sumOfBets: "0" }]
        })).toBe(3190);

        // 14 Nov MTT hand 2: won the 110 pot; start 4980, end stack 4940, contrib 40.
        expect(wonAmountFromSnapshots(hero, {
            winners: [],
            previousActions: [
                { playerId: hero, action: "call", amount: "20" },
                { playerId: hero, action: "bet", amount: "20" }
            ],
            players: [{ address: hero, stack: "4940" }]
        }, {
            players: [{ address: hero, stack: "5050" }]
        })).toBe(110);

        // 16 Nov MTT t2 hand 8: next hand already posted the 80 big blind.
        expect(wonAmountFromSnapshots(hero, {
            winners: [],
            previousActions: [
                { playerId: hero, action: "call", amount: "60" },
                { playerId: hero, action: "call", amount: "120" },
                { playerId: hero, action: "call", amount: "300" }
            ],
            players: [{ address: hero, stack: "4280", sumOfBets: "0" }]
        }, {
            players: [{ address: hero, stack: "5760", sumOfBets: "80" }]
        })).toBe(1560);
    });

    it("is 0 when the player folded or left the table without a recorded pot", () => {
        expect(wonAmountFromSnapshots(hero, {
            winners: [],
            previousActions: [
                { playerId: hero, action: "post-big-blind", amount: "40" },
                { playerId: hero, action: "fold", amount: "" }
            ],
            players: [{ address: hero, stack: "4900" }]
        }, {
            players: [{ address: hero, stack: "4900" }]
        })).toBe(0);

        expect(wonAmountFromSnapshots(hero, {
            winners: [],
            previousActions: [{ playerId: hero, action: "all-in", amount: "1830" }],
            players: [{ address: hero, stack: "0" }]
        }, {
            players: [{ address: "other", stack: "9000" }]
        })).toBe(0);
    });

    it("builds a recovered row with the derived won_amount and does not duplicate an indexer hand", () => {
        const end = {
            handNumber: 39,
            communityCards: ["AH"],
            winners: [],
            previousActions: [{ playerId: "hero", seat: 6, action: "all-in", amount: "1445" }],
            players: [{ seat: 6, address: "hero", status: "all-in", stack: "0" }]
        } as unknown as TexasHoldemStateDTO;
        const next = {
            handNumber: 40,
            winners: [],
            previousActions: [],
            players: [{ seat: 6, address: "hero", status: "active", stack: "3190", sumOfBets: "0" }]
        } as unknown as TexasHoldemStateDTO;
        const recovered = playerHandFromState("0xabc-t1", end, "hero", 1059931, next);
        expect(recovered).toMatchObject({ game_id: "0xabc-t1", hand_number: 39, won_amount: 3190, block_height: 1059931 });
        const indexed = [{ ...recovered!, won_amount: 0, community_cards: [] }];
        expect(mergeHistoryHands(indexed, [recovered!]).map(hand => hand.won_amount)).toEqual([0]);
        expect(mergeHistoryHands([], [recovered!]).map(hand => hand.won_amount)).toEqual([3190]);
    });
});
