/**
 * WS frame parsing (ui#623).
 *
 * The relay's contract is ONE JSON document per WebSocket text frame
 * (block52/pokerchain#364). This parser is the client's belt to that brace: a
 * frame is parsed as one document first; if that fails it is split on newlines
 * and each non-blank line is parsed on its own, so a relay that batches queued
 * messages NDJSON-style degrades to "every document still ingested, in order"
 * instead of "the whole batch dropped". Lines that are not JSON are COUNTED,
 * never thrown: one bad line must not cost the good ones, and never the table.
 *
 * Compact JSON never contains a raw newline (strings escape it as `\n`), so the
 * split cannot cut a document in half. Pure, framework-free (bus convention).
 */
import type { RawWsMessage } from "./ingest";
import { isBlank, isEmpty } from "../utils/guards";

export interface ParsedFrame {
    /** Every document that parsed, in wire order. `JSON.parse` output — the loosely typed inbound envelope. */
    messages: RawWsMessage[];
    /** Documents (lines, or the whole frame) that were not JSON. */
    failures: number;
}

export function parseFrame(text: string): ParsedFrame {
    try {
        return { messages: [JSON.parse(text)], failures: 0 };
    } catch {
        // Not a single document — try newline-delimited.
    }

    const messages: RawWsMessage[] = [];
    let failures = 0;
    for (const rawLine of text.split("\n")) {
        const line = rawLine.trim();
        if (isBlank(line)) {
            continue;
        }
        try {
            messages.push(JSON.parse(line));
        } catch {
            failures += 1;
        }
    }

    // A frame with nothing parseable in it (empty, whitespace, garbage on one
    // line) is one failure, so the count is never silently zero.
    if (isEmpty(messages) && failures === 0) {
        failures = 1;
    }
    return { messages, failures };
}
