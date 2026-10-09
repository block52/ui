import {
    buildHandShareUrl,
    buildShareOnXUrl,
    handEndedQuery,
    handStartedQuery,
    parseGameRecordResponse,
    historyNetworks,
    parseGameStateJson,
    parseTxSearchHeight,
    snapshotHeights
} from "./handReplay";
import { decodeStringField1, encodeStringField1, parseAbciStringResponse } from "./abciQuery";
import type { NetworkEndpoints } from "../context/NetworkContext";

const GAME = "0x54afc7ffa9e3b5f8e017a4ab5a9f0a77d766f501f49260096528179ca1db87e0";

describe("handEndedQuery", () => {
    it("matches the hand_ended event by game and hand", () => {
        expect(handEndedQuery(GAME, 20)).toBe(`hand_ended.game_id='${GAME}' AND hand_ended.hand_number='20'`);
    });
    it("has a hand_started twin", () => {
        expect(handStartedQuery(GAME, 19)).toBe(`hand_started.game_id='${GAME}' AND hand_started.hand_number='19'`);
    });
    it("rejects values that could break out of the query", () => {
        expect(() => handEndedQuery("0xabc' OR 'x'='x", 1)).toThrow();
        expect(() => handEndedQuery(GAME, 0)).toThrow();
        expect(() => handEndedQuery(GAME, 1.5)).toThrow();
    });
});

describe("parseTxSearchHeight", () => {
    it("reads the first tx height", () => {
        expect(parseTxSearchHeight({ result: { total_count: "1", txs: [{ height: "453289" }] } })).toBe(453289);
    });
    it("is null when nothing matched or the shape is wrong", () => {
        expect(parseTxSearchHeight({ result: { total_count: "0", txs: [] } })).toBeNull();
        expect(parseTxSearchHeight({})).toBeNull();
        expect(parseTxSearchHeight(null)).toBeNull();
        expect(parseTxSearchHeight({ result: { txs: [{ height: "abc" }] } })).toBeNull();
    });
});

describe("snapshotHeights", () => {
    it("tries the end block, then the block before it", () => {
        expect(snapshotHeights(453289)).toEqual([453289, 453288]);
        expect(snapshotHeights(1)).toEqual([1]);
    });
});

describe("parseGameStateJson", () => {
    it("unwraps a GameStateResponseDTO", () => {
        const p = parseGameStateJson(JSON.stringify({ format: "sit-and-go", variant: "texas-holdem", name: "T", gameState: { handNumber: 20, round: "end" } }));
        expect(p.state.handNumber).toBe(20);
        expect(p.format).toBe("sit-and-go");
        expect(p.name).toBe("T");
    });
    it("accepts a bare TexasHoldemStateDTO", () => {
        expect(parseGameStateJson(JSON.stringify({ handNumber: 3 })).state.handNumber).toBe(3);
    });
    it("rejects JSON without a hand number", () => {
        expect(() => parseGameStateJson(JSON.stringify({ foo: 1 }))).toThrow();
    });
});

describe("parseGameRecordResponse", () => {
    it("reads format/variant/name from the Game query", () => {
        const r = { game: JSON.stringify({ format: "sit-and-go", variant: "texas-holdem", name: "SNG", gameState: { handNumber: 20 } }) };
        const p = parseGameRecordResponse(r);
        expect([p.format, p.variant, p.name]).toEqual(["sit-and-go", "texas-holdem", "SNG"]);
    });
    it("rejects a response without the game JSON", () => {
        expect(() => parseGameRecordResponse({})).toThrow();
        expect(() => parseGameRecordResponse(null)).toThrow();
    });
});

describe("buildHandShareUrl", () => {
    it("links the hand number only", () => {
        expect(buildHandShareUrl("https://app.block52.xyz", GAME, 20)).toBe(`https://app.block52.xyz/table/${GAME}?hand=20`);
    });
});

describe("historyNetworks", () => {
    const official: NetworkEndpoints = { name: "Block52", rpc: "https://node1.block52.xyz/rpc/", rest: "https://node1.block52.xyz", grpc: "", ws: "" };
    const texas: NetworkEndpoints = { name: "Texas Hodl", rpc: "https://node.texashodl.net/rpc/", rest: "https://node.texashodl.net", grpc: "", ws: "" };
    const local: NetworkEndpoints = { name: "Localhost", rpc: "http://localhost:26657", rest: "http://localhost:1317", grpc: "", ws: "" };
    it("falls back to the official node for history", () => {
        expect(historyNetworks(texas, [official, texas]).map(n => n.name)).toEqual(["Texas Hodl", "Block52"]);
    });
    it("doesn't duplicate the official node", () => {
        expect(historyNetworks(official, [official, texas]).map(n => n.name)).toEqual(["Block52"]);
    });
    it("never swaps localhost for mainnet", () => {
        expect(historyNetworks(local, [official, local]).map(n => n.name)).toEqual(["Localhost"]);
    });
});

describe("abci string-field codec", () => {
    it("encodes the GameStatePublic request exactly as protobuf does", () => {
        // field 1, wire type 2 (0x0a), length 66 (0x42), then the ASCII id
        expect(encodeStringField1(GAME)).toBe("0x0a42" + Buffer.from(GAME, "ascii").toString("hex"));
    });
    it("round-trips strings longer than 127 bytes (multi-byte varint length)", () => {
        const long = JSON.stringify({ handNumber: 20, pad: "x".repeat(6000) });
        const hex = encodeStringField1(long).slice(2);
        const b64 = Buffer.from(hex, "hex").toString("base64");
        expect(decodeStringField1(b64)).toBe(long);
    });
    it("reads the value out of an abci_query response and surfaces node errors", () => {
        const b64 = Buffer.from(encodeStringField1('{"handNumber":20}').slice(2), "hex").toString("base64");
        expect(parseAbciStringResponse({ result: { response: { code: 0, value: b64 } } })).toBe('{"handNumber":20}');
        expect(() => parseAbciStringResponse({ result: { response: { code: 38, log: "version does not exist" } } })).toThrow("version does not exist");
        expect(() => parseAbciStringResponse({})).toThrow();
    });
});

describe("buildShareOnXUrl (ui#735)", () => {
    it("posts the hand's table replay link, never /explorer/hand/", () => {
        const intent = new URL(buildShareOnXUrl(buildHandShareUrl("https://app.block52.xyz", "0xabc", 13)));
        expect(intent.origin + intent.pathname).toBe("https://x.com/intent/tweet");
        expect(intent.searchParams.get("url")).toBe("https://app.block52.xyz/table/0xabc?hand=13");
        expect(intent.searchParams.get("text")).toBe("Check out this poker hand on Block52!");
        expect(intent.searchParams.get("hashtags")).toBe("Block52,Poker,OnChainPoker");
    });
});
