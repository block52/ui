import { decodeStringField1, encodeGameStateRequest, encodeStringField1 } from "./abciQuery";

const hexToBytes = (hex: string): number[] => (hex.slice(2).match(/../g) ?? []).map(b => parseInt(b, 16));

describe("encodeGameStateRequest", () => {
    it("encodes the four fields in order with protobuf tags", () => {
        const hex = encodeGameStateRequest({ gameId: "0xab", playerAddress: "b52q", timestamp: 300, signature: "0x1" });
        expect(hexToBytes(hex)).toEqual([
            0x0a, 4, 0x30, 0x78, 0x61, 0x62, // 1: "0xab"
            0x12, 4, 0x62, 0x35, 0x32, 0x71, // 2: "b52q"
            0x18, 0xac, 0x02, // 3: varint 300
            0x22, 3, 0x30, 0x78, 0x31 // 4: "0x1"
        ]);
    });

    it("encodes a real Unix timestamp as a multi-byte varint", () => {
        const hex = encodeGameStateRequest({ gameId: "g", playerAddress: "p", timestamp: 1_792_000_000, signature: "s" });
        // field 3 follows the two 3-byte string fields
        expect(hexToBytes(hex).slice(6, 12)).toEqual([0x18, 0x80, 0x80, 0xbf, 0xd6, 0x06]);
    });

    it("keeps the single-field encoder compatible with the decoder", () => {
        const hex = encodeStringField1("0xcafe");
        expect(hexToBytes(hex).slice(0, 2)).toEqual([0x0a, 6]);
        expect(decodeStringField1(btoa(String.fromCharCode(...hexToBytes(hex))))).toBe("0xcafe");
    });

    it("rejects timestamps that are not non-negative safe integers", () => {
        expect(() => encodeGameStateRequest({ gameId: "g", playerAddress: "p", timestamp: -1, signature: "s" })).toThrow("varint");
        expect(() => encodeGameStateRequest({ gameId: "g", playerAddress: "p", timestamp: 1.5, signature: "s" })).toThrow("varint");
    });
});
