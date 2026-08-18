/**
 * classifyActionError tests — routing failures to stale / transport / terminal.
 */
import { classifyActionError } from "./classifyActionError";
import { STALE_INDEX_MESSAGE } from "../hooks/playerActions/transportAction";

describe("classifyActionError", () => {
    it("classifies the rewritten stale-index message as stale", () => {
        expect(classifyActionError(new Error(STALE_INDEX_MESSAGE))).toBe("stale");
    });

    it("classifies the raw engine 'Invalid action index' as stale", () => {
        expect(classifyActionError(new Error("rpc error: Invalid action index: expected 4"))).toBe("stale");
    });

    it.each([
        "fetch failed",
        "network request failed",
        "read ECONNRESET",
        "connect ECONNREFUSED 127.0.0.1:26657",
        "socket hang up",
        "the connection was disconnected"
    ])("classifies transport-shaped error %p as transport", message => {
        expect(classifyActionError(new Error(message))).toBe("transport");
    });

    it.each([
        "insufficient funds",
        "invalid signature",
        "Block52 wallet not initialized",
        "account sequence mismatch"
    ])("classifies application error %p as terminal", message => {
        expect(classifyActionError(new Error(message))).toBe("terminal");
    });

    it("classifies a non-Error throw as terminal", () => {
        expect(classifyActionError("boom")).toBe("terminal");
        expect(classifyActionError(undefined)).toBe("terminal");
    });
});
