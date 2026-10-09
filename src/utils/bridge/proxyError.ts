import { isAxiosError } from "axios";
import { httpErrorMessage } from "../../apis/HTTPClient";

const NO_RESPONSE = "No response from the payments server";

/**
 * Words a person can act on for whatever a payments-proxy call rejected with.
 * Builds on httpErrorMessage, and adds the refusals the Bridge Admin page needs
 * to explain: a wrong admin key, a server with no admin key configured, and the
 * HTML error page App Platform serves when the proxy is down or restarting.
 */
/**
 * True when the request gave up waiting rather than being refused. For a call that
 * moves money this means "outcome unknown" — the send may still be going through —
 * so it must never be reported as "not sent".
 */
export function isProxyTimeout(err: unknown): boolean {
    return isAxiosError(err) && (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT");
}

export const STILL_GOING_THROUGH = "No answer yet — it may still be going through. Refresh the list in a minute before trying again.";

export function proxyErrorMessage(err: unknown): string {
    if (isProxyTimeout(err)) return STILL_GOING_THROUGH;
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
