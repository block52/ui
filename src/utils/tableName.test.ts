import { validateTableName, tableNameCharCount, normalizeTableName, friendlyCreateTableError, fetchTableNameAvailable } from "./tableName";
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

describe("friendlyCreateTableError (ui#878)", () => {
    it("turns the chain's taken-name refusal into one sentence", () => {
        const raw =
            'Failed to create game: transaction FBA435079FFEA84C06BCF46359EE2F35A8B4EADE9654284B642DDC25428090D4 failed with code 1104 — failed to execute message; message index: 0: table name "callfix-876" is already taken: invalid request';
        expect(friendlyCreateTableError(raw)).toBe("“callfix-876” is already taken — pick another name.");
    });

    it("strips the tx wrapper from any other chain refusal", () => {
        expect(friendlyCreateTableError("transaction ABC failed with code 5 — failed to execute message; message index: 0: insufficient funds")).toBe(
            "insufficient funds"
        );
    });

    it("leaves a plain message alone", () => {
        expect(friendlyCreateTableError("No Block52 wallet found")).toBe("No Block52 wallet found");
    });
});

describe("fetchTableNameAvailable (ui#878)", () => {
    const originalFetch = global.fetch;
    afterEach(() => {
        global.fetch = originalFetch;
    });
    const reply = (status: number, body: unknown) => {
        global.fetch = jest.fn().mockResolvedValue({ ok: status === 200, json: async () => body }) as unknown as typeof fetch;
    };

    it("asks the chain's name_available query and reads the answer", async () => {
        reply(200, { name: "friday", available: false, fee: "600000" });
        await expect(fetchTableNameAvailable("http://localhost:1317/", "friday")).resolves.toBe(false);
        expect(global.fetch).toHaveBeenCalledWith("http://localhost:1317/block52/pokerchain/poker/v1/name_available/friday", expect.anything());
        reply(200, { name: "friday", available: true, fee: "600000" });
        await expect(fetchTableNameAvailable("http://localhost:1317", "friday")).resolves.toBe(true);
    });

    it("returns null (unknown, never blocking) on errors or odd replies", async () => {
        reply(500, {});
        await expect(fetchTableNameAvailable("http://x", "friday")).resolves.toBeNull();
        reply(200, { nope: 1 });
        await expect(fetchTableNameAvailable("http://x", "friday")).resolves.toBeNull();
        global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
        await expect(fetchTableNameAvailable("http://x", "friday")).resolves.toBeNull();
    });
});
