import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { AUTH_MASKED_RETRY_MS, AUTH_RENEWAL_INTERVAL_MS, isAuthRenewalDue, isOwnHandMasked } from "./wsAuth";

const ME = "b521me";

const stateWith = (players: { address: string; holeCards?: string[] }[]): TexasHoldemStateDTO => ({ players }) as unknown as TexasHoldemStateDTO;

describe("isOwnHandMasked (ui#953)", () => {
    it("is true when our own cards arrive masked", () => {
        expect(isOwnHandMasked(stateWith([{ address: ME, holeCards: ["X", "X"] }]), ME)).toBe(true);
        expect(isOwnHandMasked(stateWith([{ address: ME, holeCards: ["??", "??", "??", "??"] }]), ME)).toBe(true);
    });

    it("is false when we can see our own cards", () => {
        expect(isOwnHandMasked(stateWith([{ address: ME, holeCards: ["AS", "KD"] }]), ME)).toBe(false);
    });

    it("ignores an opponent's masked cards, which are normal", () => {
        const state = stateWith([
            { address: ME, holeCards: ["AS", "KD"] },
            { address: "b521them", holeCards: ["X", "X"] }
        ]);
        expect(isOwnHandMasked(state, ME)).toBe(false);
    });

    it("is false between hands, with no cards to mask", () => {
        expect(isOwnHandMasked(stateWith([{ address: ME, holeCards: [] }]), ME)).toBe(false);
        expect(isOwnHandMasked(stateWith([{ address: ME }]), ME)).toBe(false);
    });

    it("is false for a spectator, who has no hand", () => {
        expect(isOwnHandMasked(stateWith([{ address: "b521them", holeCards: ["X", "X"] }]), ME)).toBe(false);
    });

    it("matches our address whatever its case", () => {
        expect(isOwnHandMasked(stateWith([{ address: ME.toUpperCase(), holeCards: ["X", "X"] }]), ME)).toBe(true);
    });

    it("is false with no state or no wallet", () => {
        expect(isOwnHandMasked(undefined, ME)).toBe(false);
        expect(isOwnHandMasked(stateWith([{ address: ME, holeCards: ["X", "X"] }]), null)).toBe(false);
    });
});

describe("isAuthRenewalDue (ui#953)", () => {
    const signedAtMs = 1_000_000;

    it("waits until the signature reaches the renewal age", () => {
        expect(isAuthRenewalDue({ nowMs: signedAtMs + AUTH_RENEWAL_INTERVAL_MS - 1, signedAtMs, ownHandMasked: false })).toBe(false);
        expect(isAuthRenewalDue({ nowMs: signedAtMs + AUTH_RENEWAL_INTERVAL_MS, signedAtMs, ownHandMasked: false })).toBe(true);
    });

    it("renews a young signature once our cards arrive masked, at most once per retry window", () => {
        expect(isAuthRenewalDue({ nowMs: signedAtMs + AUTH_MASKED_RETRY_MS - 1, signedAtMs, ownHandMasked: true })).toBe(false);
        expect(isAuthRenewalDue({ nowMs: signedAtMs + AUTH_MASKED_RETRY_MS, signedAtMs, ownHandMasked: true })).toBe(true);
    });

    it("leaves a young signature alone while our cards are visible", () => {
        expect(isAuthRenewalDue({ nowMs: signedAtMs + AUTH_MASKED_RETRY_MS, signedAtMs, ownHandMasked: false })).toBe(false);
    });
});
