import { validateTableName, tableNameCharCount, normalizeTableName } from "./tableName";
import { MAX_GAME_NAME_LENGTH, computeGameNameFee, GAME_NAME_MICRO_PER_CHAR } from "@block52/poker-vm-sdk";

describe("normalizeTableName", () => {
    it("trims and lowercases (the chain's canonical form)", () => {
        expect(normalizeTableName("  Friday-Degens  ")).toBe("friday-degens");
        expect(normalizeTableName("HIGH-ROLLERS")).toBe("high-rollers");
        expect(normalizeTableName("   ")).toBe("");
    });
});

describe("tableNameCharCount", () => {
    it("counts by code point", () => {
        expect(tableNameCharCount("")).toBe(0);
        expect(tableNameCharCount("friday-degens")).toBe(13);
    });
});

describe("validateTableName (mirrors chain ENS-style rule)", () => {
    it("allows an empty / whitespace-only name (unnamed table)", () => {
        expect(validateTableName("")).toBeNull();
        expect(validateTableName("   ")).toBeNull();
    });

    it("allows lowercase alphanumerics + single interior hyphens", () => {
        expect(validateTableName("friday-degens")).toBeNull();
        expect(validateTableName("highrollers1")).toBeNull();
        expect(validateTableName("a")).toBeNull();
    });

    it("accepts uppercase and surrounding whitespace by normalizing (chain lowercases)", () => {
        expect(validateTableName("Friday-Degens")).toBeNull();
        expect(validateTableName("  neon  ")).toBeNull();
    });

    it("rejects spaces and punctuation inside the name", () => {
        expect(validateTableName("friday degens")).not.toBeNull();
        expect(validateTableName("high_rollers")).not.toBeNull();
        expect(validateTableName("café")).not.toBeNull();
        expect(validateTableName("👑vip")).not.toBeNull();
    });

    it("rejects leading, trailing and double hyphens", () => {
        expect(validateTableName("-friday")).not.toBeNull();
        expect(validateTableName("friday-")).not.toBeNull();
        expect(validateTableName("friday--degens")).not.toBeNull();
    });

    it("rejects names longer than the cap", () => {
        expect(validateTableName("a".repeat(MAX_GAME_NAME_LENGTH))).toBeNull();
        expect(validateTableName("a".repeat(MAX_GAME_NAME_LENGTH + 1))).not.toBeNull();
    });
});

describe("computeGameNameFee (SDK cost formula, sanity)", () => {
    it("charges per code point and is free when empty", () => {
        expect(computeGameNameFee("")).toBe(0n);
        expect(computeGameNameFee("abc")).toBe(3n * GAME_NAME_MICRO_PER_CHAR);
    });
});
