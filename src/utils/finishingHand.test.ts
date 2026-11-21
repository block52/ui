import { PlayerActionType, PlayerStatus, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { captureFinishingHand, createHandRevealLedger, finishingWinnerCards, getFinishingHand, observeRevealedCards, saveFinishingHand } from "./finishingHand";

const state = {
    handNumber: 12, communityCards: ["AH", "KD", "7C", "2H", "9S"],
    winners: [{ address: "winner", amount: "600", description: "Three of a kind" }],
    players: [
        { seat: 1, address: "winner", status: PlayerStatus.SHOWING, holeCards: ["AS", "AD"] },
        { seat: 2, address: "loser", status: PlayerStatus.ALL_IN, holeCards: ["KS", "KC"] },
        { seat: 3, address: "folded", status: PlayerStatus.FOLDED, holeCards: ["QS", "QC"] },
        { seat: 4, address: "hidden", status: PlayerStatus.SHOWING, holeCards: ["X", "X"] }
    ]
} as unknown as TexasHoldemStateDTO;

it("copies the board and revealed hands without leaking folded or masked cards", () => {
    const snapshot = captureFinishingHand(state);
    expect(snapshot.board).toEqual(state.communityCards);
    expect(snapshot.players[0]).toMatchObject({ cards: ["AS", "AD"], won: "600" });
    expect(snapshot.players[1].description).not.toBe("Cards not shown");
    expect(snapshot.players[2].cards).toEqual([]);
    expect(snapshot.players[3].cards).toEqual([]);
    expect(snapshot.board).not.toBe(state.communityCards);
});

it("keeps a player's finishing hand when subsequent hands play, scoped by table and player", () => {
    const snapshot = captureFinishingHand(state);
    saveFinishingHand("table-a", "LOSER", snapshot);
    saveFinishingHand("table-a", "loser", { ...snapshot, handNumber: 13 });
    expect(getFinishingHand("table-a", "loser")?.handNumber).toBe(12);
    expect(getFinishingHand("table-b", "loser")).toBeNull();
    expect(getFinishingHand("table-a", "other")).toBeNull();
});

it("retains the engine's winning combination without leaking hidden hole cards", () => {
    const snapshot = captureFinishingHand({ ...state,
        winners: [{ address: "hidden", amount: "600", cards: ["AH", "KD", "7C", "AS", "AD"] }]
    } as unknown as TexasHoldemStateDTO);
    expect(snapshot.players[3].cards).toEqual([]);
    expect(snapshot.players[3].winningCards).toEqual(["AH", "KD", "7C"]);
    expect([...finishingWinnerCards(snapshot)]).toEqual(["AH", "KD", "7C"]);
});

it("keeps a busted player's shown cards and still hides a folded opponent", () => {
    const snapshot = captureFinishingHand({ ...state,
        previousActions: [
            { playerId: "folded", action: PlayerActionType.FOLD },
            { playerId: "busted", action: PlayerActionType.ALL_IN }
        ],
        players: [
            ...state.players,
            { seat: 5, address: "busted", status: PlayerStatus.BUSTED, holeCards: ["7H", "AS"] }
        ]
    } as unknown as TexasHoldemStateDTO);
    expect(snapshot.players.find(player => player.seat === 5)?.cards).toEqual(["7H", "AS"]);
    expect(snapshot.players[2].cards).toEqual([]);
});

it("keeps the viewer's folded hand and a voluntary show, and hides a mucked opponent", () => {
    const snapshot = captureFinishingHand({ ...state,
        previousActions: [{ playerId: "shown", action: PlayerActionType.SHOW }],
        players: [
            { seat: 1, address: "hero", status: PlayerStatus.FOLDED, holeCards: ["7H", "AS"] },
            { seat: 2, address: "shown", status: PlayerStatus.FOLDED, holeCards: ["TD", "9D"] },
            { seat: 3, address: "mucked", status: PlayerStatus.MUCKED, holeCards: ["QS", "QC"] }
        ]
    } as unknown as TexasHoldemStateDTO, { viewer: "HERO" });
    expect(snapshot.players.map(player => player.cards)).toEqual([["7H", "AS"], ["TD", "9D"], []]);
});

it("restores hands the end frame cleared after they were face up", () => {
    const ledger = createHandRevealLedger();
    const showdown = { ...state, handNumber: 8, winners: [],
        players: [
            { seat: 1, address: "winner", status: PlayerStatus.ALL_IN, holeCards: ["JH", "AH"] },
            { seat: 2, address: "seat2", status: PlayerStatus.ALL_IN, holeCards: ["QS", "QC"] },
            { seat: 4, address: "hero", status: PlayerStatus.ALL_IN, holeCards: ["7H", "AS"] }
        ]
    } as unknown as TexasHoldemStateDTO;
    observeRevealedCards(ledger, showdown, "hero", null);
    const end = { ...showdown,
        winners: [{ address: "winner", amount: "9000", description: "Pair of aces" }],
        players: [
            { seat: 1, address: "winner", status: PlayerStatus.SHOWING, holeCards: ["JH", "AH"] },
            { seat: 2, address: "seat2", status: PlayerStatus.BUSTED, holeCards: ["X", "X"] },
            { seat: 4, address: "hero", status: PlayerStatus.BUSTED, holeCards: ["X", "X"] }
        ]
    } as unknown as TexasHoldemStateDTO;
    observeRevealedCards(ledger, end, "hero", showdown);
    const snapshot = captureFinishingHand(end, { viewer: "hero", shown: ledger.shown, ownCards: ledger.ownCards });
    expect(snapshot.players.map(player => player.cards)).toEqual([["JH", "AH"], ["QS", "QC"], ["7H", "AS"]]);
});

it("keeps a shown hand when that player has left the end roster", () => {
    const shown = new Map([["gone", { seat: 3, cards: ["2C", "2D"] }]]);
    const snapshot = captureFinishingHand({ ...state, players: [state.players[0]] } as unknown as TexasHoldemStateDTO, { shown });
    expect(snapshot.players.map(player => [player.seat, player.cards])).toEqual([[1, ["AS", "AD"]], [3, ["2C", "2D"]]]);
});

it("does not replace a finishing hand with a thinner frame of the same hand", () => {
    const full = captureFinishingHand(state);
    saveFinishingHand("table-thin", "loser", full);
    saveFinishingHand("table-thin", "loser", { ...full, players: full.players.map(player => ({ ...player, cards: [] })) });
    expect(getFinishingHand("table-thin", "loser")?.players[1].cards).toEqual(["KS", "KC"]);
});

it("highlights the screenshot's winning pair and kickers, not unused community cards", () => {
    const cards = finishingWinnerCards({ handNumber: 25, board: ["4D", "AH", "2H", "6H", "3C"],
        players: [{ seat: 2, cards: ["7H", "3S"], description: "Pair of 3s", won: "9000" }] });
    expect(cards).toEqual(new Set(["3C", "3S", "AH", "7H", "6H"]));
    expect(cards.has("4D")).toBe(false);
    expect(cards.has("2H")).toBe(false);
});
