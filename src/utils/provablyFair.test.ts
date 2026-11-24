import { TexasHoldemRound, type TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import {
    DEAL_PROTOCOL,
    SET_ASIDE_CARDS,
    boardStartIndex,
    dealReproduces,
    dealtHandLabel,
    dealtSeatsFromState,
    deckFromSeed,
    handPhase,
    holeCardIndex,
    parseDealSeed,
    parseFirstTx,
    parseHandCompleted,
    parseNewHandSeed,
    placeholderChecks,
    previousHand,
    positionOfHand,
    resolvePlayers,
    seedDigest,
    verificationBanner,
    verificationRecord,
    verificationRecordFileName,
    verifyHand,
    type HandEvidence
} from "./provablyFair";

// A real mainnet hand (table 0x85152c…4fb7, hand 12, started at block 962868):
// eight seats dealt in, seats 2 and 4 shown down, seat 2's three kings won.
// Its new-hand tx carried this seed; the board and shown hands are what the
// chain's public state showed at the hand's end (block 962890).
const MAINNET_SEED = "45583a8e8a5fbb6e3d66baa1960e44ef8723c3498d805b67bf0a0eee118a17f3";
const MAINNET_DECK_TOP = "8H 3S 7C JD 6C 8C 5C TS AC KC AS QD AD 9H 6D 3C 3D 2S 8D 2D QS 6H KS KD JS QH".split(" ");
const MAINNET: HandEvidence = {
    seed: MAINNET_SEED,
    holeCardsPerPlayer: 2,
    board: ["6H", "KS", "KD", "JS", "QH"],
    shownHands: [
        ["3S", "KC"],
        ["JD", "QD"]
    ],
    dealtSeats: [1, 2, 3, 4, 5, 6, 7, 8]
};

describe("parseDealSeed", () => {
    it("reads the 32-byte seed from a new-hand's data", () => {
        expect(parseDealSeed(`seed=${MAINNET_SEED}`)).toBe(MAINNET_SEED);
        expect(parseDealSeed(`foo=1&seed=${MAINNET_SEED.toUpperCase()}&bar=2`)).toBe(MAINNET_SEED);
    });

    it("is null without a well-formed seed", () => {
        expect(parseDealSeed("")).toBeNull();
        expect(parseDealSeed(undefined)).toBeNull();
        expect(parseDealSeed("seed=abcd")).toBeNull();
        expect(parseDealSeed(`seed=${MAINNET_SEED}00`)).toBeNull();
        expect(parseDealSeed(`deck=${MAINNET_DECK_TOP.join("-")}`)).toBeNull();
    });
});

describe("deckFromSeed", () => {
    it("reproduces the deck the chain dealt the mainnet hand from", () => {
        const deck = deckFromSeed(MAINNET_SEED);
        expect(deck).toHaveLength(52);
        expect(new Set(deck).size).toBe(52);
        expect(deck.slice(0, MAINNET_DECK_TOP.length)).toEqual(MAINNET_DECK_TOP);
    });

    it("is the SHA-256 of the seed bytes the chain records", () => {
        expect(seedDigest(MAINNET_SEED)).toBe("88d9a00e24ace628a5ed443110518f08dd8b67ec2123b6f1b10d6eba617bef3c");
    });
});

describe("deal layout", () => {
    it("deals hole cards round by round, sets five aside, then the board", () => {
        expect(holeCardIndex(8, 0, 1)).toBe(1);
        expect(holeCardIndex(8, 1, 1)).toBe(9);
        expect(boardStartIndex(8, 2)).toBe(16 + SET_ASIDE_CARDS);
        expect(boardStartIndex(3, 4)).toBe(12 + SET_ASIDE_CARDS);
    });

    it("finds a shown hand's deal position, in either card order", () => {
        const deck = deckFromSeed(MAINNET_SEED);
        expect(positionOfHand(deck, 8, 2, ["3S", "KC"])).toBe(1);
        expect(positionOfHand(deck, 8, 2, ["QD", "JD"])).toBe(3);
        expect(positionOfHand(deck, 8, 2, ["3S", "QD"])).toBeNull();
        expect(positionOfHand(deck, 8, 2, ["3S"])).toBeNull();
    });

    it("only the true player count reproduces the board", () => {
        const deck = deckFromSeed(MAINNET_SEED);
        expect(dealReproduces(deck, 8, 2, MAINNET.board, MAINNET.shownHands)).toBe(true);
        expect(dealReproduces(deck, 7, 2, MAINNET.board, MAINNET.shownHands)).toBe(false);
    });
});

describe("resolvePlayers", () => {
    const deck = deckFromSeed(MAINNET_SEED);

    it("takes the dealt seats from the hand's own end state", () => {
        expect(resolvePlayers(deck, 2, MAINNET.board, MAINNET.shownHands, MAINNET.dealtSeats)).toEqual({ players: 8, seatsKnown: true });
    });

    it("infers the count from the shown cards when the end state is another hand's", () => {
        expect(resolvePlayers(deck, 2, MAINNET.board, MAINNET.shownHands, null)).toEqual({ players: 8, seatsKnown: false });
        expect(resolvePlayers(deck, 2, [], [["JD", "QD"]], null)).toEqual({ players: 8, seatsKnown: false });
    });

    it("falls back to inference when the state disagrees (a player left mid-hand)", () => {
        expect(resolvePlayers(deck, 2, MAINNET.board, MAINNET.shownHands, [1, 2, 3, 4, 5, 6, 7])).toEqual({ players: 8, seatsKnown: false });
    });

    it("knows nothing when nothing was shown and the state can't be read", () => {
        expect(resolvePlayers(deck, 2, [], [], null)).toEqual({ players: null, seatsKnown: false });
    });
});

describe("verifyHand", () => {
    it("verifies the mainnet hand: seed, board and both shown hands", () => {
        const v = verifyHand(MAINNET);
        expect(v.verdict).toBe("verified");
        expect(v.checks.map(c => [c.id, c.status])).toEqual([
            ["seed", "pass"],
            ["board", "pass"],
            ["shown", "pass"]
        ]);
        expect(v.players).toBe(8);
        expect(v.board).toEqual(MAINNET.board);
        expect(v.setAside).toEqual(["3D", "2S", "8D", "2D", "QS"]);
        expect(v.hands).toHaveLength(8);
        expect(v.hands[1]).toEqual({ position: 1, seat: 2, cards: ["3S", "KC"], shown: true });
        expect(v.hands[0]).toEqual({ position: 0, seat: 1, cards: ["8H", "AC"], shown: false });
        expect(v.checks[1].detail).toContain("cards 22–26");
    });

    it("still verifies when seats can't be labelled, without inventing seats", () => {
        const v = verifyHand({ ...MAINNET, dealtSeats: null });
        expect(v.verdict).toBe("verified");
        expect(v.hands.every(h => h.seat === null)).toBe(true);
    });

    it("fails a board the deck doesn't deal", () => {
        const v = verifyHand({ ...MAINNET, board: ["6H", "KS", "KD", "JS", "2C"] });
        expect(v.verdict).toBe("failed");
        expect(v.checks.find(c => c.id === "board")?.status).toBe("fail");
    });

    it("fails a shown hand the deal never gave", () => {
        const v = verifyHand({ ...MAINNET, shownHands: [["3S", "KC"], ["JD", "AS"]] });
        expect(v.verdict).toBe("failed");
        expect(v.checks.find(c => c.id === "shown")).toMatchObject({ status: "fail", detail: "1 of 2 shown hands match the recomputed deal." });
        // The board still checks out: one bad hand fails only its own check.
        expect(v.checks.find(c => c.id === "board")?.status).toBe("pass");
    });

    it("checks a three-card board when the hand ended on the flop", () => {
        const v = verifyHand({ ...MAINNET, board: MAINNET.board.slice(0, 3), shownHands: [] });
        expect(v.verdict).toBe("verified");
        expect(v.board).toEqual(["6H", "KS", "KD"]);
        expect(v.checks.find(c => c.id === "shown")?.status).toBe("skipped");
    });

    it("says nothing was shown for a hand folded before the flop", () => {
        const v = verifyHand({ ...MAINNET, board: [], shownHands: [] });
        expect(v.verdict).toBe("nothing-shown");
        expect(v.checks.filter(c => c.id !== "seed").every(c => c.status === "skipped")).toBe(true);
        expect(v.hands).toHaveLength(8);
    });

    it("is unavailable without a seed", () => {
        const v = verifyHand({ ...MAINNET, seed: null });
        expect(v.verdict).toBe("unavailable");
        expect(v.deck).toBeNull();
        expect(v.hands).toEqual([]);
    });

    it("deals four hole cards each at Omaha", () => {
        const deck = deckFromSeed(MAINNET_SEED);
        const players = 3;
        const hand = (position: number) => [0, 1, 2, 3].map(round => deck[holeCardIndex(players, round, position)]);
        const start = boardStartIndex(players, 4);
        const v = verifyHand({ seed: MAINNET_SEED, holeCardsPerPlayer: 4, board: deck.slice(start, start + 5), shownHands: [hand(2)], dealtSeats: [2, 5, 9] });
        expect(v.verdict).toBe("verified");
        expect(v.hands[2]).toMatchObject({ seat: 9, shown: true, cards: hand(2) });
    });
});

describe("chain data parsing", () => {
    const handEndedSearch = {
        result: {
            txs: [
                {
                    hash: "FD64AD68",
                    height: "962890",
                    tx_result: {
                        events: [
                            { type: "hand_ended", attributes: [{ key: "game_id", value: "0x85" }] },
                            {
                                type: "hand_completed",
                                attributes: [
                                    { key: "community_cards", value: "6H,KS,KD,JS,QH" },
                                    { key: "revealed_hole_cards", value: "3S,KC,JD,QD" }
                                ]
                            }
                        ]
                    }
                }
            ]
        }
    };

    it("reads the first tx of a tx_search with its events", () => {
        const hit = parseFirstTx(handEndedSearch);
        expect(hit).toMatchObject({ hash: "FD64AD68", height: 962890 });
        expect(hit?.events.map(e => e.type)).toEqual(["hand_ended", "hand_completed"]);
        expect(parseFirstTx({ result: { txs: [] } })).toBeNull();
        expect(parseFirstTx(null)).toBeNull();
    });

    it("reads the board and shown hands from hand_completed", () => {
        expect(parseHandCompleted(parseFirstTx(handEndedSearch), 2)).toEqual({ board: MAINNET.board, shownHands: MAINNET.shownHands });
        const foldOut = { result: { txs: [{ hash: "A", height: "5", tx_result: { events: [{ type: "hand_completed", attributes: [{ key: "community_cards", value: "" }, { key: "revealed_hole_cards", value: "" }] }] } }] } };
        expect(parseHandCompleted(parseFirstTx(foldOut), 2)).toEqual({ board: [], shownHands: [] });
        expect(parseHandCompleted(null, 2)).toBeNull();
    });

    it("reads the seed from the new-hand message of a REST tx", () => {
        const rest = { tx: { body: { messages: [{ "@type": "/pokerchain.poker.v1.MsgPerformAction", action: "new-hand", data: `seed=${MAINNET_SEED}` }] } } };
        expect(parseNewHandSeed(rest)).toBe(MAINNET_SEED);
        expect(parseNewHandSeed({ tx: { body: { messages: [{ action: "new-hand", data: "" }] } } })).toBeNull();
        expect(parseNewHandSeed({ tx: { body: { messages: [{ action: "call", data: `seed=${MAINNET_SEED}` }] } } })).toBeNull();
        expect(parseNewHandSeed(undefined)).toBeNull();
    });

    it("takes dealt seats only from the hand's own end state", () => {
        const state = (handNumber: number) =>
            ({
                handNumber,
                players: [
                    { seat: 4, holeCards: ["X", "X"] },
                    { seat: 2, holeCards: ["3S", "KC"] },
                    { seat: 7 },
                    { seat: 9, holeCards: [] }
                ]
            }) as unknown as TexasHoldemStateDTO;
        expect(dealtSeatsFromState(state(12), 12, 2)).toEqual([2, 4]);
        expect(dealtSeatsFromState(state(13), 12, 2)).toBeNull();
        expect(dealtSeatsFromState(null, 12, 2)).toBeNull();
    });
});

describe("handPhase", () => {
    it("is running until the live table reaches the end of that hand", () => {
        expect(handPhase({ handNumber: 5, round: TexasHoldemRound.FLOP }, 5)).toBe("running");
        expect(handPhase({ handNumber: 5, round: TexasHoldemRound.END }, 5)).toBe("ended");
        expect(handPhase({ handNumber: 6, round: TexasHoldemRound.PREFLOP }, 5)).toBe("ended");
        expect(handPhase({ handNumber: 5, round: TexasHoldemRound.FLOP }, 6)).toBe("unknown");
        expect(handPhase(null, 5)).toBe("unknown");
    });
});

describe("verificationRecord", () => {
    it("carries everything needed to redo the checks", () => {
        const verification = verifyHand(MAINNET);
        const record = verificationRecord({
            tableId: "0x85",
            handNumber: 12,
            startTx: { hash: "8D5A0518", height: 962868 },
            endHeight: 962890,
            evidence: MAINNET,
            verification
        });
        expect(record).toMatchObject({
            protocol: DEAL_PROTOCOL,
            handNumber: 12,
            seed: MAINNET_SEED,
            seedSha256: "88d9a00e24ace628a5ed443110518f08dd8b67ec2123b6f1b10d6eba617bef3c",
            verdict: "verified"
        });
        expect((record.recomputed as { deck: string[] }).deck).toHaveLength(52);
    });
});

describe("presentation", () => {
    it("heads the window by status, then by verdict", () => {
        expect(verificationBanner("pending", null, null).tone).toBe("pending");
        expect(verificationBanner("loading", null, null)).toEqual({ tone: "neutral", text: "Reading the hand from the chain…" });
        expect(verificationBanner("error", null, "nodes are down").text).toBe("nodes are down");
        expect(verificationBanner("ready", verifyHand(MAINNET), null).tone).toBe("verified");
        expect(verificationBanner("ready", verifyHand({ ...MAINNET, board: [], shownHands: [] }), null).tone).toBe("neutral");
        expect(verificationBanner("ready", verifyHand({ ...MAINNET, board: ["2C"] }), null).tone).toBe("failed");
        expect(verificationBanner("ready", verifyHand({ ...MAINNET, seed: null }), null).text).toContain("can't be recomputed");
    });

    it("lists the three checks while there are no results", () => {
        expect(placeholderChecks("Opens when the hand ends.").map(c => c.id)).toEqual(["seed", "board", "shown"]);
    });

    it("labels a dealt hand by seat, or by deal position when seats are unknown", () => {
        expect(dealtHandLabel({ seat: 4, position: 3 })).toBe("Seat 4");
        expect(dealtHandLabel({ seat: null, position: 3 })).toBe("Player 4");
    });

    it("names the record after the table and hand", () => {
        expect(verificationRecordFileName("0x85152c519a42d8cc", 12)).toBe("block52-hand-0x85152c51-12.json");
    });
});

describe("previousHand", () => {
    it("is the hand before the live one", () => {
        expect(previousHand({ handNumber: 2 })).toBe(1);
        expect(previousHand({ handNumber: 1 })).toBeNull();
        expect(previousHand(null)).toBeNull();
    });
});
