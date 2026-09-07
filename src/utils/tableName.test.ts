import { validateTableName, tableNameCharCount } from "./tableName";
import { MAX_GAME_NAME_LENGTH, computeGameNameFee, GAME_NAME_MICRO_PER_CHAR } from "@block52/poker-vm-sdk";

describe("tableNameCharCount", () => {
    it("counts by code point", () => {
        expect(tableNameCharCount("")).toBe(0);
        expect(tableNameCharCount("Friday Degens")).toBe(13);
    });
});

describe("validateTableName", () => {
    it("allows an empty name (unnamed table)", () => {
        expect(validateTableName("")).toBeNull();
    });

    it("allows printable ASCII names within the cap", () => {
        expect(validateTableName("Friday Degens")).toBeNull();
        expect(validateTableName("High Rollers #1")).toBeNull();
    });

    it("rejects leading/trailing whitespace", () => {
        expect(validateTableName(" Friday")).not.toBeNull();
        expect(validateTableName("Friday ")).not.toBeNull();
    });

    it("rejects non-printable / exotic characters", () => {
        expect(validateTableName("Café")).not.toBeNull();
        expect(validateTableName("👑 VIP")).not.toBeNull();
    });

    it("rejects names longer than the cap", () => {
        expect(validateTableName("x".repeat(MAX_GAME_NAME_LENGTH))).toBeNull();
        expect(validateTableName("x".repeat(MAX_GAME_NAME_LENGTH + 1))).not.toBeNull();
    });
});

describe("computeGameNameFee (SDK cost formula, sanity)", () => {
    it("charges per code point and is free when empty", () => {
        expect(computeGameNameFee("")).toBe(0n);
        expect(computeGameNameFee("abc")).toBe(3n * GAME_NAME_MICRO_PER_CHAR);
    });
});
