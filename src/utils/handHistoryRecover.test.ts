import { PlayerStatus, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import type { NetworkEndpoints } from "../context/NetworkContext";
import type { HandListItem } from "../pages/explorer/types";
import type { PlayerHand, PlayerSession } from "../types/players";
import { encodeStringField1 } from "./abciQuery";
import { endedHandsFromTxSearch, isFollowingHandSnapshot, isPriorHandSnapshot, loadPublicHandState, mergeHandEndHeights, recoverUnlistedHands, type HistoryRpc } from "./handHistoryRecover";
import { handEndedTableQuery } from "./handReplay";

const network: NetworkEndpoints = {
    name: "Localhost",
    rpc: "http://rpc.test",
    rest: "http://rest.test",
    grpc: "http://grpc.test",
    ws: "ws://rpc.test/ws"
};

const listed = (hand_number: number): PlayerHand => ({
    game_id: "0xabc",
    hand_number,
    seat: 1,
    status: "folded",
    won_amount: 0,
    block_height: 60,
    community_cards: ["AH"],
    winner_count: 1
});

const gameHand = (hand_number: number, block_height: number, game_id = "0xabc"): HandListItem => ({
    game_id,
    hand_number,
    block_height,
    deck_seed: "",
    deck: "",
    tx_hash: "",
    created_at: ""
});

const session = (join_block: number, leave_block?: number, game_id = "0xabc"): PlayerSession => ({
    player_address: "hero",
    game_id,
    join_block,
    leave_block,
    buy_in_amount: 0,
    created_at: ""
});

function chainState(handNumber: number, viewerPlayed: boolean): TexasHoldemStateDTO {
    return {
        handNumber,
        communityCards: ["AH", "KD", "7C"],
        winners: [],
        previousActions: viewerPlayed ? [{ playerId: "hero", seat: 2, action: "fold" }] : [{ playerId: "other", seat: 1, action: "fold" }],
        players: [
            {
                seat: 2,
                address: "hero",
                status: PlayerStatus.FOLDED,
                holeCards: viewerPlayed ? ["QH", "QD"] : ["X", "X"]
            },
            { seat: 3, address: "shown", status: PlayerStatus.SHOWING, holeCards: ["AS", "AD"] },
            { seat: 4, address: "mucked", status: PlayerStatus.MUCKED, holeCards: ["QS", "QC"] }
        ]
    } as unknown as TexasHoldemStateDTO;
}

function abci(json: string) {
    const hex = encodeStringField1(json).slice(2);
    return { result: { response: { code: 0, value: Buffer.from(hex, "hex").toString("base64") } } };
}

function rpcFor(states: Map<number, TexasHoldemStateDTO | "prune" | "next">, searched: number[]): HistoryRpc {
    return {
        txSearch: async query => {
            const match = query.match(/hand_number='(\d+)'/);
            const handNumber = Number(match?.[1]);
            searched.push(handNumber);
            // End block is a multiple of 10 so the previous block still rounds back to this hand.
            return { result: { txs: [{ height: String(handNumber * 10) }] } };
        },
        abciQuery: async (_path, _data, height) => {
            const handNumber = Math.round(height / 10);
            const state = states.get(handNumber);
            if (state === "prune") throw new Error("version does not exist");
            // The end block itself has already moved on to the next hand.
            if (height % 10 === 0 || !state || state === "next") {
                return abci(JSON.stringify({ handNumber: handNumber + 1 }));
            }
            return abci(JSON.stringify(state));
        }
    };
}

describe("recoverUnlistedHands", () => {
    it("adds a played hand the indexer skipped and ignores sit-out and hands outside the session", async () => {
        const searched: number[] = [];
        const states = new Map<number, TexasHoldemStateDTO | "prune" | "next">([
            [11, chainState(11, true)],
            [9, chainState(9, false)]
        ]);
        const err = jest.spyOn(console, "error").mockImplementation(() => {});
        const recovered = await recoverUnlistedHands({
            address: "hero",
            listed: [listed(12)],
            sessions: async () => ({
                data: [session(10, 80)],
                pagination: { limit: 100, offset: 0, total: 1 }
            }),
            gameHands: async () => ({
                data: [gameHand(12, 70), gameHand(11, 50), gameHand(9, 40), gameHand(8, 200)],
                pagination: { limit: 1000, offset: 0, total: 4 }
            }),
            rpcFor: () => rpcFor(states, searched),
            networks: [network]
        });
        err.mockRestore();

        expect(recovered.hands.map(hand => hand.hand_number)).toEqual([11]);
        expect(recovered.hands[0]).toMatchObject({ seat: 2, status: PlayerStatus.FOLDED, block_height: 110 });
        expect(recovered.states.get("0xabc#11")?.handNumber).toBe(11);
        expect(searched.sort((a, b) => a - b)).toEqual([9, 11]);
    });

    it("skips a hand whose state has been pruned", async () => {
        const searched: number[] = [];
        const err = jest.spyOn(console, "error").mockImplementation(() => {});
        const recovered = await recoverUnlistedHands({
            address: "hero",
            listed: [],
            sessions: async () => ({ data: [session(1)], pagination: { limit: 100, offset: 0, total: 1 } }),
            gameHands: async () => ({
                data: [gameHand(4, 20)],
                pagination: { limit: 1000, offset: 0, total: 1 }
            }),
            rpcFor: () => rpcFor(new Map([[4, "prune"]]), searched),
            networks: [network]
        });
        err.mockRestore();
        expect(recovered.hands).toEqual([]);
        expect(searched).toEqual([4]);
    });
});

describe("recoverUnlistedHands MTT table ids", () => {
    it("recovers a -t1 hand and skips ids that could break the query", async () => {
        const mtt = "0xabc-t1";
        const malicious = ["0xabc' OR '1'='1", "0xabc -t1", "0xabc;drop"];
        const queries: string[] = [];
        const err = jest.spyOn(console, "error").mockImplementation(() => {});
        const recovered = await recoverUnlistedHands({
            address: "hero",
            listed: [],
            sessions: async () => ({
                data: [mtt, ...malicious].map(game_id => session(1, 100, game_id)),
                pagination: { limit: 100, offset: 0, total: 1 + malicious.length }
            }),
            gameHands: async gameId => ({
                data: [gameHand(5, 40, gameId)],
                pagination: { limit: 1000, offset: 0, total: 1 }
            }),
            rpcFor: () => ({
                txSearch: async query => {
                    queries.push(query);
                    return { result: { txs: [{ height: "50" }] } };
                },
                abciQuery: async (_path, _data, height) => {
                    if (height === 50) return abci(JSON.stringify({ handNumber: 6 }));
                    return abci(JSON.stringify(chainState(5, true)));
                }
            }),
            networks: [network]
        });

        // Known indexer height 40 already shows hand 5, so tx_search is not needed.
        expect(queries).toEqual([]);
        expect(recovered.hands.map(hand => hand.game_id)).toEqual([mtt]);
        expect(recovered.hands[0].hand_number).toBe(5);
        expect(recovered.states.get(`${mtt}#5`)?.handNumber).toBe(5);
        expect(err.mock.calls.map(call => String(call[0]))).toEqual([
            "Skipping a hand history id the chain query cannot express:",
            "Skipping a hand history id the chain query cannot express:",
            "Skipping a hand history id the chain query cannot express:"
        ]);
        err.mockRestore();
    });

    it("recovers a -t1 hand when an earlier table has no indexed hands", async () => {
        const mtt = "0xabc-t1";
        const empty = "0xempty";
        const queries: string[] = [];
        const err = jest.spyOn(console, "error").mockImplementation(() => {});
        const recovered = await recoverUnlistedHands({
            address: "hero",
            listed: [],
            sessions: async () => ({
                data: [session(1, 100, empty), session(1, 100, mtt)],
                pagination: { limit: 100, offset: 0, total: 2 }
            }),
            gameHands: async gameId =>
                gameId === empty
                    ? { data: null as unknown as ReturnType<typeof gameHand>[], pagination: { limit: 1000, offset: 0, total: 0 } }
                    : { data: [gameHand(5, 40, gameId)], pagination: { limit: 1000, offset: 0, total: 1 } },
            rpcFor: () => ({
                txSearch: async query => {
                    queries.push(query);
                    return { result: { txs: [{ height: "50" }] } };
                },
                abciQuery: async (_path, _data, height) => {
                    if (height === 50) return abci(JSON.stringify({ handNumber: 6 }));
                    return abci(JSON.stringify(chainState(5, true)));
                }
            }),
            networks: [network]
        });

        expect(queries).toEqual([]);
        expect(recovered.hands.map(hand => hand.game_id)).toEqual([mtt]);
        err.mockRestore();
    });
});

describe("loadPublicHandState", () => {
    it("uses the previous block when the end block already shows the next hand", async () => {
        const calls: number[] = [];
        const rpc: Pick<HistoryRpc, "abciQuery"> = {
            abciQuery: async (_path, _data, height) => {
                calls.push(height);
                if (height === 80) return abci(JSON.stringify({ handNumber: 16 }));
                return abci(JSON.stringify(chainState(15, true)));
            }
        };
        const state = await loadPublicHandState("0xabc", 15, 80, [network], () => rpc);
        expect(calls).toEqual([80, 79]);
        expect(state?.handNumber).toBe(15);
        expect(state?.players?.[0].holeCards).toEqual(["QH", "QD"]);
    });
});

describe("endedHandsFromTxSearch", () => {
    it("reads unique finished hands for one table and ignores other tables or failed txs", () => {
        const gameId = "0xabc-t1";
        expect(handEndedTableQuery(gameId)).toBe("hand_ended.game_id='0xabc-t1'");
        const rows = endedHandsFromTxSearch({
            tx_responses: [
                {
                    code: 0,
                    height: "10",
                    events: [{ type: "hand_ended", attributes: [
                        { key: "game_id", value: gameId },
                        { key: "hand_number", value: "1" },
                        { key: "block_height", value: "10" }
                    ] }]
                },
                {
                    code: 0,
                    height: "20",
                    events: [{ type: "hand_ended", attributes: [
                        { key: "game_id", value: "0xother-t1" },
                        { key: "hand_number", value: "2" },
                        { key: "block_height", value: "20" }
                    ] }]
                },
                {
                    code: 1,
                    height: "30",
                    events: [{ type: "hand_ended", attributes: [
                        { key: "game_id", value: gameId },
                        { key: "hand_number", value: "3" }
                    ] }]
                }
            ]
        }, gameId);
        expect(rows).toEqual([{ game_id: gameId, hand_number: 1, block_height: 10 }]);
    });
});


describe("mergeHandEndHeights", () => {
    it("keeps the later chain end height when the indexer stored the start block", () => {
        const t1 = "0xabc-t1";
        const merged = mergeHandEndHeights(
            [gameHand(39, 1_059_926, t1), gameHand(38, 1_059_920, t1)],
            [{ game_id: t1, hand_number: 39, block_height: 1_059_931 }, { game_id: t1, hand_number: 1, block_height: 1_059_414 }]
        );
        expect(merged).toEqual(expect.arrayContaining([
            expect.objectContaining({ hand_number: 39, block_height: 1_059_931 }),
            expect.objectContaining({ hand_number: 38, block_height: 1_059_920 }),
            expect.objectContaining({ hand_number: 1, block_height: 1_059_414 })
        ]));
        expect(merged.filter(hand => hand.hand_number === 39)).toHaveLength(1);
    });
});

describe("hand-end snapshot direction", () => {
    it("distinguishes the next hand from the previous one", () => {
        expect(isFollowingHandSnapshot({ handNumber: 40 }, 39)).toBe(true);
        expect(isFollowingHandSnapshot({ handNumber: 38 }, 39)).toBe(false);
        expect(isFollowingHandSnapshot(undefined, 39)).toBe(false);
        expect(isPriorHandSnapshot({ handNumber: 38 }, 39)).toBe(true);
        expect(isPriorHandSnapshot({ handNumber: 40 }, 39)).toBe(false);
    });
});

describe("recoverUnlistedHands extra tournament tables", () => {
    it("searches extra MTT table ids and fills indexer gaps from endedHands", async () => {
        const t1 = "0xabc-t1";
        const t2 = "0xabc-t2";
        const searched: string[] = [];
        const err = jest.spyOn(console, "error").mockImplementation(() => {});
        const recovered = await recoverUnlistedHands({
            address: "hero",
            listed: [],
            sessions: async () => ({ data: [], pagination: { limit: 100, offset: 0, total: 0 } }),
            gameHands: async gameId =>
                gameId === t1
                    ? { data: [gameHand(2, 40, t1)], pagination: { limit: 1000, offset: 0, total: 1 } }
                    : { data: null as unknown as ReturnType<typeof gameHand>[], pagination: { limit: 1000, offset: 0, total: 0 } },
            endedHands: async gameId =>
                gameId === t1 ? [{ game_id: t1, hand_number: 1, block_height: 10 }] : [],
            extraGameIds: [t1, t2],
            rpcFor: () => ({
                txSearch: async query => {
                    searched.push(query);
                    const match = query.match(/hand_number='(\d+)'/);
                    return { result: { txs: [{ height: String(Number(match?.[1]) * 10) }] } };
                },
                abciQuery: async (_path, _data, height) => {
                    const handNumber = Math.round(height / 10);
                    if (height % 10 === 0) return abci(JSON.stringify({ handNumber: handNumber + 1 }));
                    return abci(JSON.stringify(chainState(handNumber, true)));
                }
            }),
            networks: [network]
        });
        err.mockRestore();
        // Hand 1's endedHands height (10 / 9) already shows that hand, so tx_search is skipped.
        // Hand 2's indexer height 40 does not, so it falls back to tx_search (height 20).
        expect(searched).toEqual([`hand_ended.game_id='${t1}' AND hand_ended.hand_number='2'`]);
        expect(recovered.hands.map(hand => hand.hand_number).sort((a, b) => a - b)).toEqual([1, 2]);
        expect(recovered.hands.every(hand => hand.game_id === t1)).toBe(true);
    });

    it("uses a known end height and does not tx_search when that snapshot is the hand", async () => {
        const mtt = "0xabc-t1";
        const searched: string[] = [];
        const err = jest.spyOn(console, "error").mockImplementation(() => {});
        const recovered = await recoverUnlistedHands({
            address: "hero",
            listed: [],
            sessions: async () => ({ data: [], pagination: { limit: 100, offset: 0, total: 0 } }),
            gameHands: async () => ({ data: [gameHand(5, 50, mtt)], pagination: { limit: 1000, offset: 0, total: 1 } }),
            extraGameIds: [mtt],
            rpcFor: () => ({
                txSearch: async query => {
                    searched.push(query);
                    return { result: { txs: [{ height: "50" }] } };
                },
                abciQuery: async (_path, _data, height) => {
                    if (height === 50) return abci(JSON.stringify({ handNumber: 6 }));
                    return abci(JSON.stringify(chainState(5, true)));
                }
            }),
            networks: [network]
        });
        err.mockRestore();
        expect(searched).toEqual([]);
        expect(recovered.hands).toHaveLength(1);
        expect(recovered.hands[0]).toMatchObject({ game_id: mtt, hand_number: 5, block_height: 50 });
    });

    it("derives won_amount from the next hand when winners[] is empty", async () => {
        const mtt = "0xabc-t1";
        const hero = "hero";
        const err = jest.spyOn(console, "error").mockImplementation(() => {});
        const endState = {
            handNumber: 39,
            communityCards: [],
            winners: [],
            previousActions: [{ playerId: hero, seat: 6, action: "all-in", amount: "1445" }],
            players: [{ seat: 6, address: hero, status: "all-in", stack: "0", sumOfBets: "1445" }]
        };
        const nextState = {
            handNumber: 40,
            winners: [],
            previousActions: [],
            players: [{ seat: 6, address: hero, status: "active", stack: "3190", sumOfBets: "0" }]
        };
        const recovered = await recoverUnlistedHands({
            address: hero,
            listed: [],
            sessions: async () => ({ data: [], pagination: { limit: 100, offset: 0, total: 0 } }),
            gameHands: async () => ({ data: [gameHand(39, 1059931, mtt)], pagination: { limit: 1000, offset: 0, total: 1 } }),
            extraGameIds: [mtt],
            rpcFor: () => ({
                txSearch: async () => ({ result: { txs: [{ height: "1059931" }] } }),
                abciQuery: async (_path, _data, height) => {
                    if (height === 1059931) return abci(JSON.stringify(nextState));
                    return abci(JSON.stringify(endState));
                }
            }),
            networks: [network]
        });
        err.mockRestore();
        expect(recovered.hands).toHaveLength(1);
        expect(recovered.hands[0]).toMatchObject({ game_id: mtt, hand_number: 39, won_amount: 3190, block_height: 1059931 });
    });

    // Live 14 Nov MTT: indexer listed hand 39 at 1059926 (the start, when 38 ended).
    // The real hand_ended height is 1059931. Using the start height as the end
    // saw a preflop seat with no actions and skipped the hand.
    const startOf39 = {
        handNumber: 39,
        communityCards: [],
        winners: [],
        previousActions: [],
        players: [{ seat: 6, address: "hero", status: "active", stack: "1445", sumOfBets: "0" }]
    };
    const endOf39 = {
        handNumber: 39,
        communityCards: [],
        winners: [],
        previousActions: [{ playerId: "hero", seat: 6, action: "all-in", amount: "1445" }],
        players: [{ seat: 6, address: "hero", status: "all-in", stack: "0", sumOfBets: "1445" }]
    };
    const startOf40 = {
        handNumber: 40,
        winners: [],
        previousActions: [],
        players: [{ seat: 6, address: "hero", status: "active", stack: "3190", sumOfBets: "0" }]
    };
    const endOf38 = {
        handNumber: 38,
        winners: [],
        previousActions: [{ playerId: "hero", seat: 6, action: "fold" }],
        players: [{ seat: 6, address: "hero", status: "folded", stack: "1445", sumOfBets: "0" }]
    };
    const liveAbci = async (_path: string, _data: string, height: number) => {
        if (height === 1_059_931) return abci(JSON.stringify(startOf40));
        if (height === 1_059_930) return abci(JSON.stringify(endOf39));
        if (height === 1_059_926) return abci(JSON.stringify(startOf39));
        if (height === 1_059_925) return abci(JSON.stringify(endOf38));
        throw new Error(`unexpected height ${height}`);
    };

    it("prefers the chain end height when the indexer stored the start of the hand", async () => {
        const mtt = "0x275a79-t1";
        const searched: string[] = [];
        const err = jest.spyOn(console, "error").mockImplementation(() => {});
        const recovered = await recoverUnlistedHands({
            address: "hero",
            listed: [],
            sessions: async () => ({ data: [], pagination: { limit: 100, offset: 0, total: 0 } }),
            gameHands: async () => ({ data: [gameHand(39, 1_059_926, mtt)], pagination: { limit: 1000, offset: 0, total: 1 } }),
            endedHands: async () => [{ game_id: mtt, hand_number: 39, block_height: 1_059_931 }],
            extraGameIds: [mtt],
            rpcFor: () => ({
                txSearch: async query => {
                    searched.push(query);
                    return { result: { txs: [{ height: "1059931" }] } };
                },
                abciQuery: liveAbci
            }),
            networks: [network]
        });
        err.mockRestore();
        expect(searched).toEqual([]);
        expect(recovered.hands).toHaveLength(1);
        expect(recovered.hands[0]).toMatchObject({ game_id: mtt, hand_number: 39, won_amount: 3190, block_height: 1_059_931 });
    });

    it("falls back to tx_search when the only known height is the start of the hand", async () => {
        const mtt = "0x275a79-t1";
        const searched: string[] = [];
        const err = jest.spyOn(console, "error").mockImplementation(() => {});
        const recovered = await recoverUnlistedHands({
            address: "hero",
            listed: [],
            sessions: async () => ({ data: [], pagination: { limit: 100, offset: 0, total: 0 } }),
            gameHands: async () => ({ data: [gameHand(39, 1_059_926, mtt)], pagination: { limit: 1000, offset: 0, total: 1 } }),
            extraGameIds: [mtt],
            rpcFor: () => ({
                txSearch: async query => {
                    searched.push(query);
                    return { result: { txs: [{ height: "1059931" }] } };
                },
                abciQuery: liveAbci
            }),
            networks: [network]
        });
        err.mockRestore();
        expect(searched).toEqual([`hand_ended.game_id='${mtt}' AND hand_ended.hand_number='39'`]);
        expect(recovered.hands).toHaveLength(1);
        expect(recovered.hands[0]).toMatchObject({ game_id: mtt, hand_number: 39, won_amount: 3190, block_height: 1_059_931 });
    });
});
