/**
 * Session History labels for one chain game record.
 *
 * Format, variant and stakes come from the cached /game/{id} payload
 * (GamePrizeMeta). A missing field is left off the label — nothing is filled
 * in with a default variant or a guessed stake. The filter lists only the
 * labels that actually occur.
 *
 * Finishing place for a prize row uses the same rules as the explorer:
 * gameState.results[].place for this player, otherwise a payout amount that
 * matches exactly one gameState.payouts entry. finishing_order is not a place
 * (an early claim lists only the players who have busted). No match, no label.
 */
import { BettingLimit, GameFormat, isCashFormat, isTournamentFormat } from "@block52/poker-vm-sdk";
import { displayGameFormat } from "./createGameType";
import { formatGameFormatDisplay, formatTableGameDisplay, getBlindsForDisplay, toGameFormat, toGameVariant } from "./gameFormatUtils";
import { hasContent, hasValue } from "./guards";
import { formatMicroUsd } from "./moneyDisplay";
import { placeOrdinal, resolvePrizePlace, type GamePrizeMeta } from "./transactionUtils";

/** Filter value that shows every session. */
export const ALL_SESSION_GAMES = "all";

export interface SessionGameLabel {
    /** "Sit & Go · Texas Hold'em" */
    title: string;
    /** "$0.01 / $0.02" or "$2.00 buy-in". Absent when the record has no stake. */
    detail?: string;
    /** Same as the title, so one option covers every table that reads the same. */
    filterKey: string;
}

export interface SessionGameFilterOption {
    key: string;
    label: string;
}

/** What to call the format, in the same words as the create form. */
function sessionFormatLabel(format: GameFormat, scheduledStartTime: number | undefined, gameId?: string): string {
    const displayed = displayGameFormat(format, scheduledStartTime, formatGameFormatDisplay, gameId);
    if (displayed === "Cash") return "Cash Game";
    if (displayed === "Sit And Go") return "Sit & Go";
    if (displayed === "Tournament") return "Tournament";
    return displayed;
}

function knownBettingLimit(value: string | undefined): BettingLimit | undefined {
    if (value === BettingLimit.NO_LIMIT || value === BettingLimit.POT_LIMIT || value === BettingLimit.FIXED_LIMIT) return value;
    return undefined;
}

function dollar(micro: string): string | undefined {
    const label = formatMicroUsd(micro);
    if (!hasContent(label) || label === "—") return undefined;
    return `$${label}`;
}

/** Cash games show the blinds. Sit & Go and tournaments show the buy-in. Chip blinds are not dollars. */
function sessionStakeDetail(format: GameFormat, meta: GamePrizeMeta): string | undefined {
    if (isCashFormat(format)) {
        if (!hasContent(meta.smallBlind) || !hasContent(meta.bigBlind)) return undefined;
        const blinds = getBlindsForDisplay(format, meta.smallBlind, meta.bigBlind);
        return hasContent(blinds.stakeLabel) ? blinds.stakeLabel : undefined;
    }
    if (!isTournamentFormat(format) || !hasContent(meta.minBuyIn)) return undefined;
    const min = dollar(meta.minBuyIn);
    if (!hasContent(min)) return undefined;
    if (!hasContent(meta.maxBuyIn) || meta.maxBuyIn === meta.minBuyIn) return `${min} buy-in`;
    const max = dollar(meta.maxBuyIn);
    if (!hasContent(max)) return `${min} buy-in`;
    return `${min} – ${max} buy-in`;
}

/** Title, stake line and filter key for one game. Undefined when the record has no format. */
export function sessionGameLabel(meta: GamePrizeMeta | undefined, gameId?: string): SessionGameLabel | undefined {
    if (!hasValue(meta) || !hasValue(meta.format)) return undefined;
    const format = toGameFormat(meta.format);
    if (!hasValue(format)) return undefined;
    const formatLabel = sessionFormatLabel(format, meta.scheduledStartTime, gameId);
    if (!hasContent(formatLabel)) return undefined;
    const variant = toGameVariant(meta.variant);
    const variantLabel = hasValue(variant) ? formatTableGameDisplay(variant, knownBettingLimit(meta.bettingLimit)) : "";
    const title = hasContent(variantLabel) ? `${formatLabel} · ${variantLabel}` : formatLabel;
    const detail = sessionStakeDetail(format, meta);
    return hasContent(detail) ? { title, detail, filterKey: title } : { title, filterKey: title };
}

/**
 * The variant to open on. The one with the most sessions, and on a tie the
 * one whose latest join is more recent. A further tie follows the menu order
 * (cash, then sit & go, then tournament). Sessions with no game label are
 * skipped. Undefined when nothing is labelled.
 */
export function defaultSessionVariant(
    rows: Array<{ gameId: string; joinBlock: number }>,
    labels: Record<string, SessionGameLabel | undefined>
): string | undefined {
    const byKey = new Map<string, { count: number; latestJoin: number }>();
    for (const row of rows) {
        const key = labels[row.gameId]?.filterKey;
        if (!hasContent(key) || !Number.isFinite(row.joinBlock)) continue;
        const current = byKey.get(key);
        if (!hasValue(current)) {
            byKey.set(key, { count: 1, latestJoin: row.joinBlock });
            continue;
        }
        current.count += 1;
        if (row.joinBlock > current.latestJoin) current.latestJoin = row.joinBlock;
    }
    const ranked = [...byKey.entries()].sort(
        (a, b) => b[1].count - a[1].count || b[1].latestJoin - a[1].latestJoin || formatRank(a[0]) - formatRank(b[0]) || a[0].localeCompare(b[0])
    );
    return ranked[0]?.[0];
}

/** One label per distinct title, Cash Game then Sit & Go then Tournament. */
export function sessionGameFilterOptions(labels: Array<SessionGameLabel | undefined>): SessionGameFilterOption[] {
    const byKey = new Map<string, SessionGameFilterOption>();
    for (const label of labels) {
        if (!hasValue(label) || byKey.has(label.filterKey)) continue;
        byKey.set(label.filterKey, { key: label.filterKey, label: label.title });
    }
    return [...byKey.values()].sort((a, b) => formatRank(a.label) - formatRank(b.label) || a.label.localeCompare(b.label));
}

function formatRank(label: string): number {
    if (label.startsWith("Cash Game")) return 0;
    if (label.startsWith("Sit & Go")) return 1;
    if (label.startsWith("Single-table tournament") || label.startsWith("Tournament")) return 2;
    if (label.startsWith("Multi-table tournament")) return 3;
    return 4;
}

export function sessionLabelsByGameId(byId: Record<string, GamePrizeMeta | undefined>): Record<string, SessionGameLabel | undefined> {
    const labels: Record<string, SessionGameLabel | undefined> = {};
    for (const [id, meta] of Object.entries(byId)) {
        labels[id] = sessionGameLabel(meta, id);
    }
    return labels;
}

/** Keep every row for All. A specific game drops rows whose label is missing or different. */
export function filterSessionRows<T extends { gameId: string }>(rows: T[], labels: Record<string, SessionGameLabel | undefined>, filterKey: string): T[] {
    if (!hasContent(filterKey) || filterKey === ALL_SESSION_GAMES) return rows;
    return rows.filter(row => labels[row.gameId]?.filterKey === filterKey);
}

/**
 * "1st", "2nd", … for a prize row whose place is in the game record.
 * Undefined when it isn't a prize, or the record doesn't say — never a guess.
 */
export function sessionPrizePlaceLabel(row: { isPrize: boolean; cashOut?: number }, meta: GamePrizeMeta | undefined, player: string): string | undefined {
    if (!row.isPrize || !hasValue(meta) || !hasContent(player)) return undefined;
    const place = resolvePrizePlace({
        player,
        results: meta.results,
        payouts: meta.payouts,
        prizeAmount: hasValue(row.cashOut) ? String(row.cashOut) : undefined
    });
    if (!hasValue(place)) return undefined;
    const ordinal = placeOrdinal(place);
    return hasContent(ordinal) ? ordinal : undefined;
}

/** Join block, leave block, and length shown when a phone session row is expanded. */
export interface SessionRowExpandDetail {
    joinBlock: string;
    leaveBlock: string;
    /** "400 blocks", or "—" when the seat is still open or the span is not positive. */
    length: string;
}

/**
 * The three facts a phone row reveals. Length is leave minus join, the same
 * span as Longest Session. An open seat, or a leave that is not after the
 * join, has no length.
 */
function sessionLengthBlocks(joinBlock: number, leaveBlock: number | undefined): number | undefined {
    if (!hasValue(leaveBlock)) return undefined;
    if (!Number.isSafeInteger(joinBlock) || !Number.isSafeInteger(leaveBlock)) return undefined;
    if (leaveBlock <= joinBlock) return undefined;
    return leaveBlock - joinBlock;
}

export function sessionRowExpandDetail(joinBlock: number, leaveBlock: number | undefined): SessionRowExpandDetail {
    const span = sessionLengthBlocks(joinBlock, leaveBlock);
    return {
        joinBlock: joinBlock.toLocaleString(),
        leaveBlock: hasValue(leaveBlock) ? leaveBlock.toLocaleString() : "—",
        length: hasValue(span) ? `${span.toLocaleString()} blocks` : "—"
    };
}

/** Game ids in first-seen order, skipping blanks and repeats. */
export function uniqueGameIds(ids: Array<string | undefined>): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
        if (!hasContent(id) || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}
