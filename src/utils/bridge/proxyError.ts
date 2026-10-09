import { httpErrorMessage } from "../../apis/HTTPClient";

const NO_RESPONSE = "No response from the payments server";

/**
 * Words a person can act on for whatever a payments-proxy call rejected with.
 * Builds on httpErrorMessage, and adds the refusals the Bridge Admin page needs
 * to explain: a wrong admin key, a server with no admin key configured, and the
 * HTML error page App Platform serves when the proxy is down or restarting.
 */
export function proxyErrorMessage(err: unknown): string {
    if (typeof err === "string") return looksLikeHtml(err) ? "The payments server is unavailable right now" : err.trim() || NO_RESPONSE;
    return explain(httpErrorMessage(err, NO_RESPONSE));
}

function explain(message: string): string {
    if (message === "Unauthorized") return "Admin key not accepted — check it and try again";
    if (/ADMIN_API_KEY is not configured/.test(message)) return "The payments server has no admin key set yet (ADMIN_API_KEY on the App Platform app)";
    return message;
}

function looksLikeHtml(s: string): boolean {
    return /^\s*</.test(s);
}
