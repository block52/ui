import { AxiosError, AxiosHeaders } from "axios";
import { httpErrorMessage, httpStatusText, isNetworkError } from "../apis/HTTPClient";

// Separate from http.client.test.ts, which mocks axios wholesale — these guards
// need the real `isAxiosError`.

const axiosError = (code?: string, status?: number, statusText = "") =>
    new AxiosError(
        "Request failed",
        code,
        undefined,
        undefined,
        status === undefined ? undefined : { status, statusText, data: {}, headers: {}, config: { headers: new AxiosHeaders() } }
    );

describe("httpErrorMessage", () => {
    it("reads an Error's message", () => {
        expect(httpErrorMessage(new Error("boom"), "fallback")).toBe("boom");
    });

    it("reads the server's { error } body that onError throws", () => {
        expect(httpErrorMessage({ error: "Amount too small" }, "fallback")).toBe("Amount too small");
    });

    it("reads a { message } body", () => {
        expect(httpErrorMessage({ message: "Bad request" }, "fallback")).toBe("Bad request");
    });

    it("falls back for anything else", () => {
        expect(httpErrorMessage({ error: 42 }, "fallback")).toBe("fallback");
        expect(httpErrorMessage("plain string", "fallback")).toBe("fallback");
        expect(httpErrorMessage(null, "fallback")).toBe("fallback");
        expect(httpErrorMessage(undefined, "fallback")).toBe("fallback");
    });
});

describe("isNetworkError", () => {
    it("is true only for an axios ERR_NETWORK", () => {
        expect(isNetworkError(axiosError("ERR_NETWORK"))).toBe(true);
        expect(isNetworkError(axiosError("ECONNABORTED"))).toBe(false);
        expect(isNetworkError(Object.assign(new Error("x"), { code: "ERR_NETWORK" }))).toBe(false);
        expect(isNetworkError(undefined)).toBe(false);
    });
});

describe("httpStatusText", () => {
    it("formats the status of an axios error with a response", () => {
        expect(httpStatusText(axiosError(undefined, 503, "Service Unavailable"))).toBe("503 - Service Unavailable");
    });

    it("is undefined without a response", () => {
        expect(httpStatusText(axiosError("ERR_NETWORK"))).toBeUndefined();
        expect(httpStatusText(new Error("x"))).toBeUndefined();
    });
});
