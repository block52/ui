import {
    accountAddressOf,
    accountTypeLabel,
    parseAccountBalanceResponse,
    parseAccountsResponse,
    parseCardStats,
    parseIndexerStatus,
    parseRandomnessReport,
    parseStatsSummary,
    parseValidatorsResponse
} from "./typeConversions";

const card = { card: "As", rank: "A", suit: "s", total_appearances: 10, expected_frequency: 0.019, actual_frequency: 0.02, deviation: 1, deviation_percent: 5 };
const chi = { chi_squared: 44.1, degrees_of_freedom: 51, p_value: 0.74, result: "PASS", interpretation: "Fair" };

describe("parseCardStats", () => {
    it("accepts valid stats and lower-cases the suit", () => {
        expect(parseCardStats([{ ...card, suit: "S" }])[0].suit).toBe("s");
    });

    it("rejects a non-array, an unknown suit and a missing field", () => {
        expect(() => parseCardStats({})).toThrow("card stats must be an array");
        expect(() => parseCardStats([{ ...card, suit: "x" }])).toThrow('unknown suit "x"');
        expect(() => parseCardStats([{ ...card, total_appearances: "10" }])).toThrow("total_appearances must be a number");
        expect(() => parseCardStats([{ card: "As" }])).toThrow('missing "suit"');
    });
});

describe("parseRandomnessReport", () => {
    const report = { card_chi_squared: chi, suit_chi_squared: chi, rank_chi_squared: { ...chi, result: "MARGINAL" } };

    it("accepts every known result", () => {
        expect(parseRandomnessReport(report).rank_chi_squared.result).toBe("MARGINAL");
        for (const result of ["PASS", "MARGINAL", "FAIL", "NO_DATA"]) {
            expect(parseRandomnessReport({ ...report, card_chi_squared: { ...chi, result } }).card_chi_squared.result).toBe(result);
        }
    });

    it("rejects an unknown result string", () => {
        expect(() => parseRandomnessReport({ ...report, card_chi_squared: { ...chi, result: "MAYBE" } })).toThrow('unknown result "MAYBE"');
    });

    it("rejects a missing test and null", () => {
        expect(() => parseRandomnessReport({ card_chi_squared: chi })).toThrow('missing "suit_chi_squared"');
        expect(() => parseRandomnessReport(null)).toThrow("must be an object");
    });
});

describe("parseStatsSummary / parseIndexerStatus", () => {
    it("parses a summary and rejects a string count", () => {
        const summary = { total_hands: 5, total_completed_hands: 4, total_revealed_cards: 20, unique_games: 1 };
        expect(parseStatsSummary(summary)).toEqual(summary);
        expect(() => parseStatsSummary({ ...summary, total_hands: "5" })).toThrow("total_hands must be a number");
    });

    it("parses a status and rejects NaN", () => {
        const status = { total_blocks: 9, blocks_indexed: 8, percent_complete: 88.8, last_block_indexed: 9, first_block_indexed: 1, total_hands: 2, total_games: 1 };
        expect(parseIndexerStatus(status)).toEqual(status);
        expect(() => parseIndexerStatus({ ...status, total_blocks: Number.NaN })).toThrow("total_blocks must be a number");
    });
});

describe("parseValidatorsResponse", () => {
    const validator = { operator_address: "b52valoper1abc", status: "BOND_STATUS_BONDED", description: { moniker: "node1" } };

    it("parses validators, ignoring extra fields", () => {
        expect(parseValidatorsResponse({ validators: [{ ...validator, tokens: "1" }] }).validators).toEqual([validator]);
    });

    it("rejects a missing list or moniker", () => {
        expect(() => parseValidatorsResponse({})).toThrow('missing "validators"');
        expect(() => parseValidatorsResponse({ validators: [{ ...validator, description: {} }] })).toThrow('missing "moniker"');
    });
});

describe("parseAccountsResponse / accountAddressOf", () => {
    it("reads the address from each account variant", () => {
        const { accounts } = parseAccountsResponse({
            accounts: [
                { "@type": "/cosmos.auth.v1beta1.BaseAccount", address: "b521a" },
                { "@type": "/cosmos.auth.v1beta1.ModuleAccount", base_account: { address: "b521b" }, name: "x" },
                { "@type": "/cosmos.vesting.v1beta1.ContinuousVestingAccount", base_vesting_account: { base_account: { address: "b521c" } } },
                { "@type": "/cosmos.auth.v1beta1.Other" }
            ]
        });
        expect(accounts.map(accountAddressOf)).toEqual(["b521a", "b521b", "b521c", null]);
    });

    it("rejects an account without a type", () => {
        expect(() => parseAccountsResponse({ accounts: [{ address: "b521a" }] })).toThrow('missing "@type"');
    });
});

describe("parseAccountBalanceResponse", () => {
    it("parses coins and rejects a numeric amount", () => {
        expect(parseAccountBalanceResponse({ balances: [{ denom: "usdc", amount: "5" }] }).balances).toEqual([{ denom: "usdc", amount: "5" }]);
        expect(() => parseAccountBalanceResponse({ balances: [{ denom: "usdc", amount: 5 }] })).toThrow("amount must be a string");
    });
});

describe("accountTypeLabel", () => {
    it("names the base account and strips the proto path from the rest", () => {
        expect(accountTypeLabel("/cosmos.auth.v1beta1.BaseAccount")).toBe("B52 Account");
        expect(accountTypeLabel("/cosmos.auth.v1beta1.ModuleAccount")).toBe("ModuleAccount");
        expect(accountTypeLabel("weird.")).toBe("weird.");
    });
});
