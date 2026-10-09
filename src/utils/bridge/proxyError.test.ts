import { AxiosError } from "axios";
import { proxyErrorMessage, isProxyTimeout } from "./proxyError";

describe("proxyErrorMessage", () => {
    it("explains a rejected admin key", () => {
        expect(proxyErrorMessage({ error: "Unauthorized" })).toBe("Admin key not accepted — check it and try again");
    });

    it("explains a server with no admin key configured (503 fail-closed)", () => {
        expect(proxyErrorMessage({ error: "Admin endpoints are disabled: ADMIN_API_KEY is not configured on the server" })).toMatch(/no admin key set yet/);
    });

    it("passes the proxy's own refusal through", () => {
        expect(proxyErrorMessage({ success: false, error: "Nothing left to bridge for this payment" })).toBe("Nothing left to bridge for this payment");
    });

    it("uses message when there is no error field (Axios network error)", () => {
        expect(proxyErrorMessage(new Error("Network Error"))).toBe("Network Error");
    });

    it("an HTML error page (App Platform 503/504) becomes plain words", () => {
        expect(proxyErrorMessage("<!DOCTYPE html><p>Error code: 503</p>")).toBe("The payments server is unavailable right now");
    });

    it("anything else says there was no usable response, never 'undefined'", () => {
        expect(proxyErrorMessage(undefined)).toBe("No response from the payments server");
        expect(proxyErrorMessage({})).toBe("No response from the payments server");
    });

    it("a timeout is 'may still be going through', never a failure", () => {
        const timeout = new AxiosError("timeout of 5000ms exceeded", "ECONNABORTED");
        expect(isProxyTimeout(timeout)).toBe(true);
        expect(proxyErrorMessage(timeout)).toMatch(/may still be going through/);
        expect(isProxyTimeout({ error: "Unauthorized" })).toBe(false);
        expect(isProxyTimeout(new AxiosError("Network Error", "ERR_NETWORK"))).toBe(false);
    });
});
