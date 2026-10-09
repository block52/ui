import { describe, it, expect } from "@jest/globals";
import { transactionFlow, formatSignedUsdc, joinDetail } from "./transactionRow";

describe("transactionRow", () => {
    describe("transactionFlow", () => {
        it("is incoming when USDC was received", () => {
            expect(transactionFlow({ transferDirection: "received", action: "leave" })).toBe("in");
        });

        it("is outgoing when USDC was sent", () => {
            expect(transactionFlow({ transferDirection: "sent" })).toBe("out");
        });

        it("treats buy-ins and table creation as outgoing without transfer info", () => {
            expect(transactionFlow({ action: "join" })).toBe("out");
            expect(transactionFlow({ action: "create" })).toBe("out");
        });

        it("is neutral for poker actions with no transfer", () => {
            expect(transactionFlow({ action: "call" })).toBe("neutral");
            expect(transactionFlow({})).toBe("neutral");
        });
    });

    describe("formatSignedUsdc", () => {
        it("prefixes + for incoming", () => {
            expect(formatSignedUsdc("25000000", "in")).toBe("+$25.00");
        });

        it("prefixes a minus sign for outgoing", () => {
            expect(formatSignedUsdc("2000000", "out")).toBe("−$2.00");
        });

        it("has no sign when neutral", () => {
            expect(formatSignedUsdc("100000", "neutral")).toBe("$0.10");
        });
    });

    describe("joinDetail", () => {
        it("joins present parts with a middle dot", () => {
            expect(joinDetail("Table 840d", "5 minutes ago")).toBe("Table 840d · 5 minutes ago");
        });

        it("skips missing or empty parts", () => {
            expect(joinDetail(undefined, "", "1 hour ago")).toBe("1 hour ago");
        });
    });
});
