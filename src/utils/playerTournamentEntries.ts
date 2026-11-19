/**
 * Multi-table tournament rows for profile Session History.
 *
 * MTT entry is MsgRegisterTournament. The player never joins a table, so the
 * indexer has no session and the history table used to skip the tournament.
 * These rows are built from `tournament_registered` plus the tournament record
 * (`getTournament`). One row per tournament, keyed as `<tournamentId>-t<first table>`
 * so the existing label, link and hand filter can see it.
 *
 * A busted finish (payout 0) stays an open row: Session History already turns
 * that, plus `results[]`, into "0.00" and the place. The leave block for that
 * row is supplied beside the row (the last indexed hand on the tournament's
 * tables) so the open-row check still fires. A paid finish writes the payout
 * on the row. A tournament the player is still in has no cash-out, so the
 * totals leave it out as an open session.
 */
import type { TournamentStateDTO } from "../types/tournament";
import type { PlayerHand } from "../types/players";
import { hasContent, hasElements, hasValue, isEmpty, isNumber, isRecord, isString } from "./guards";
import { prizeMicroIsPositive } from "./prizeDisplay";
import { parseTournamentGameId, tournamentGameId } from "./tableUrl";
import { gameIdFromTableId } from "./tournamentFollow";
import { parseTournamentState } from "./tournamentBlinds";
import { placeOrdinal, type GamePrizeMeta, type GameResultPlace } from "./transactionUtils";
import type { SessionPrizeRow } from "./playerPrizeClaims";

/** Every successful tournament registration. The node accepts this event query. */
export const ALL_TOURNAMENT_REGISTERED_QUERY = "tournament_registered.player EXISTS";

/** Every successful tournament unregistration. The node accepts this event query. */
export const ALL_TOURNAMENT_UNREGISTERED_QUERY = "tournament_unregistered.player EXISTS";

/** Event query for one player's tournament registrations. `player` must already be a safe address. */
export function tournamentRegisteredQuery(player: string): string {
    return `tournament_registered.player='${player}'`;
}

/** Event query for one player's tournament unregistrations. `player` must already be a safe address. */
export function tournamentUnregisteredQuery(player: string): string {
    return `tournament_unregistered.player='${player}'`;
}

const TOURNAMENT_ID = /^0x[0-9a-fA-F]+$/;

/** One successful `tournament_registered` event. */
export interface TournamentRegistration {
    tournamentId: string;
    height: number;
    /** Micro-USDC from the event. Absent when the attribute was missing or not a digit string. */
    buyIn?: number;
    entryFee?: number;
}

/** One successful `tournament_unregistered` event. */
export interface TournamentUnregistration {
    tournamentId: string;
    height: number;
    txhash: string;
    /** Micro-USDC refunded (the escrowed net buy-in). */
    refund?: number;
}

/** What Session History needs from one tournament the player registered for. */
export interface PlayerTournamentEntry {
    tournamentId: string;
    registerHeight: number;
    /** Buy-in plus entry fee, USDC micro-units. */
    buyIn: number;
    /** `<tournamentId>-t<first table>`. */
    gameId: string;
    /** Every `<tournamentId>-t*` table from the tournament record. */
    tableGameIds?: string[];
    status: TournamentStateDTO["status"];
    results: GameResultPlace[];
    /** Unregister refund, micro-USDC, when they left before the start. */
    refund?: number;
    /** Block the refund was committed in, when they unregistered. */
    unregisterHeight?: number;
}

type HandBlock = Pick<PlayerHand, "game_id" | "block_height">;

/**
 * True when both ids are the same table, or two tables of one multi-table
 * tournament (`<id>-t1` covers a hand on `<id>-t2`). Any other pair has to
 * match exactly.
 */
export function sameTournamentSession(sessionGameId: string, handGameId: string): boolean {
    if (sessionGameId === handGameId) return true;
    const sessionTable = parseTournamentGameId(sessionGameId);
    const handTable = parseTournamentGameId(handGameId);
    if (!hasValue(sessionTable) || !hasValue(handTable)) return false;
    return sessionTable.tournamentId.toLowerCase() === handTable.tournamentId.toLowerCase();
}

function eventMicro(value: string | undefined): number | undefined {
    if (!hasContent(value) || !/^\d+$/.test(value)) return undefined;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
}

/** A missing entry fee is none. An entry fee that isn't a digit string is not zero. */
function feeMicro(value: string | undefined): number | undefined {
    if (!hasContent(value)) return 0;
    return eventMicro(value);
}

function txSucceeded(tx: Record<string, unknown>): boolean {
    if (isNumber(tx.code)) return tx.code === 0;
    return isString(tx.code) && tx.code === "0";
}

function txHeight(tx: Record<string, unknown>): number | undefined {
    if (isNumber(tx.height) && Number.isSafeInteger(tx.height) && tx.height > 0) return tx.height;
    if (!isString(tx.height) || !/^\d+$/.test(tx.height)) return undefined;
    const height = Number(tx.height);
    return Number.isSafeInteger(height) && height > 0 ? height : undefined;
}

function attributesOf(event: Record<string, unknown>): Record<string, string> {
    const fields: Record<string, string> = {};
    if (!Array.isArray(event.attributes)) return fields;
    for (const attribute of event.attributes) {
        if (!isRecord(attribute) || !isString(attribute.key) || !isString(attribute.value)) continue;
        fields[attribute.key] = attribute.value;
    }
    return fields;
}

/**
 * Successful `tournament_registered` events in a GetTxsEvent body, grouped by
 * lowercase player. A tx with code !== 0 is not an entry. Ids that aren't a
 * 0x hash are dropped so they are never interpolated into a later query.
 */
export function tournamentRegistrationsByPlayer(body: unknown): Map<string, TournamentRegistration[]> {
    const grouped = new Map<string, TournamentRegistration[]>();
    if (!isRecord(body) || !Array.isArray(body.tx_responses)) return grouped;
    for (const tx of body.tx_responses) {
        if (!isRecord(tx) || !txSucceeded(tx)) continue;
        const height = txHeight(tx);
        if (!hasValue(height) || !Array.isArray(tx.events)) continue;
        for (const event of tx.events) {
            if (!isRecord(event) || event.type !== "tournament_registered") continue;
            const fields = attributesOf(event);
            if (!hasContent(fields.player) || !hasContent(fields.tournament_id) || !TOURNAMENT_ID.test(fields.tournament_id)) continue;
            const player = fields.player.toLowerCase();
            const registration: TournamentRegistration = { tournamentId: fields.tournament_id, height };
            const buyIn = eventMicro(fields.buy_in);
            if (hasValue(buyIn)) registration.buyIn = buyIn;
            const entryFee = eventMicro(fields.entry_fee);
            if (hasValue(entryFee)) registration.entryFee = entryFee;
            const list = grouped.get(player) ?? [];
            list.push(registration);
            grouped.set(player, list);
        }
    }
    return grouped;
}

/**
 * Successful `tournament_registered` events for `player` in a GetTxsEvent body.
 * A tx with code !== 0 is not an entry. Ids that aren't a 0x hash are dropped
 * so they are never interpolated into a later query.
 */
export function tournamentRegistrationsFromTxSearch(body: unknown, player: string): TournamentRegistration[] {
    if (!hasContent(player)) return [];
    return tournamentRegistrationsByPlayer(body).get(player.toLowerCase()) ?? [];
}

/** One registration per tournament: the earliest successful one. */
export function earliestRegistrations(registrations: TournamentRegistration[]): TournamentRegistration[] {
    const byId = new Map<string, TournamentRegistration>();
    const ordered = [...registrations].sort((a, b) => a.height - b.height || a.tournamentId.localeCompare(b.tournamentId));
    for (const registration of ordered) {
        const key = registration.tournamentId.toLowerCase();
        if (byId.has(key)) continue;
        byId.set(key, registration);
    }
    return [...byId.values()];
}

/**
 * Buy-in plus entry fee, in micro-USDC. The event amounts win. A missing piece
 * falls back to the tournament options; a missing entry fee is none.
 */
export function registrationBuyIn(
    registration: Pick<TournamentRegistration, "buyIn" | "entryFee">,
    options: { buyIn?: string; entryFee?: string }
): number | undefined {
    const buyIn = hasValue(registration.buyIn) ? registration.buyIn : eventMicro(options.buyIn);
    if (!hasValue(buyIn)) return undefined;
    const fee = hasValue(registration.entryFee) ? registration.entryFee : feeMicro(options.entryFee);
    if (!hasValue(fee)) return undefined;
    const total = buyIn + fee;
    return Number.isSafeInteger(total) ? total : undefined;
}

/** Every table of a tournament (`<id>-t1`, `<id>-t2`, â€¦). `t1` when the record lists none yet. */
export function tournamentTableGameIds(tournamentId: string, tables: Array<{ tableId?: string; ordinal?: number }>): string[] {
    const candidates: Array<{ ordinal: number; gameId: string }> = [];
    for (const table of tables) {
        if (!isString(table.tableId) || !hasContent(table.tableId) || !isNumber(table.ordinal)) continue;
        try {
            candidates.push({ ordinal: table.ordinal, gameId: gameIdFromTableId(table.tableId) });
        } catch {
            continue;
        }
    }
    if (isEmpty(candidates)) return [tournamentGameId(tournamentId, 1)];
    candidates.sort((a, b) => a.ordinal - b.ordinal || a.gameId.localeCompare(b.gameId));
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const candidate of candidates) {
        const key = candidate.gameId.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        ids.push(candidate.gameId);
    }
    return ids;
}

/** Game id of the first table (lowest ordinal). `t1` when the tournament has no table yet. */
export function firstTournamentTableGameId(tournamentId: string, tables: Array<{ tableId?: string; ordinal?: number }>): string {
    return tournamentTableGameIds(tournamentId, tables)[0];
}

/** Tables to walk for this entry. Falls back to the first-table id when the record listed none. */
export function tableGameIdsOf(entry: Pick<PlayerTournamentEntry, "gameId" | "tableGameIds">): string[] {
    return hasElements(entry.tableGameIds) ? entry.tableGameIds : [entry.gameId];
}

function resultPlaces(results: TournamentStateDTO["results"] | undefined): GameResultPlace[] {
    if (!hasElements(results)) return [];
    const places: GameResultPlace[] = [];
    for (const result of results) {
        if (!isNumber(result.place) || !Number.isInteger(result.place) || result.place < 1) continue;
        if (!isString(result.playerId) || !hasContent(result.playerId)) continue;
        const place: GameResultPlace = { place: result.place, playerId: result.playerId };
        if (isString(result.payout)) place.payout = result.payout;
        places.push(place);
    }
    return places;
}

/** The tournament query body (`{ tournament }`) as the engine record, or undefined when it isn't one. */
export function readTournamentRecord(raw: unknown): TournamentStateDTO | undefined {
    if (!isRecord(raw)) return undefined;
    const body = raw.tournament;
    try {
        if (isString(body)) return parseTournamentState(body);
        if (isRecord(body)) return parseTournamentState(JSON.stringify(body));
    } catch (err) {
        console.error("Failed to parse tournament:", err);
        return undefined;
    }
    return undefined;
}

/** One history entry. Undefined when the buy-in can't be read or the record is for a different tournament. */
export function tournamentEntryFromRegistration(
    registration: TournamentRegistration,
    state: TournamentStateDTO,
    player: string
): PlayerTournamentEntry | undefined {
    if (!hasContent(player) || state.tournamentId.toLowerCase() !== registration.tournamentId.toLowerCase()) return undefined;
    const buyIn = registrationBuyIn(registration, state.options);
    if (!hasValue(buyIn)) return undefined;
    return {
        tournamentId: state.tournamentId,
        registerHeight: registration.height,
        buyIn,
        gameId: firstTournamentTableGameId(state.tournamentId, state.tables),
        tableGameIds: tournamentTableGameIds(state.tournamentId, state.tables),
        status: state.status,
        results: resultPlaces(state.results)
    };
}

function ownResult(results: GameResultPlace[], player: string): GameResultPlace | undefined {
    const want = player.toLowerCase();
    return results.find(result => result.playerId.toLowerCase() === want);
}

/** Payout of a finished tournament, when the player cashed. 0 stays off the row so the bust cell can show the place. */
export function paidTournamentPrize(entry: PlayerTournamentEntry, player: string): number | undefined {
    return paidCashOut(entry, player);
}

function paidCashOut(entry: PlayerTournamentEntry, player: string): number | undefined {
    if (entry.status !== "finished" || !hasContent(player)) return undefined;
    const mine = ownResult(entry.results, player);
    if (!hasValue(mine) || !prizeMicroIsPositive(mine.payout)) return undefined;
    const payout = Number(mine.payout);
    return Number.isSafeInteger(payout) ? payout : undefined;
}

/** In the results with nothing paid. The row stays open so the bust cell can show 0.00 and the place. */
function unpaidResult(entry: PlayerTournamentEntry, player: string): boolean {
    if (!hasContent(player)) return false;
    const mine = ownResult(entry.results, player);
    if (!hasValue(mine) || !hasContent(mine.payout)) return false;
    return !prizeMicroIsPositive(mine.payout);
}

/**
 * The highest hand-end block this player has on the tournament's tables, at or
 * after they registered. Undefined when the loaded hands don't include one:
 * the leave cell stays blank rather than guessing.
 */
export function lastTournamentHandBlock(hands: readonly HandBlock[], tournamentId: string, joinBlock: number): number | undefined {
    if (!hasContent(tournamentId)) return undefined;
    const key = tournamentId.toLowerCase();
    let best: number | undefined;
    for (const hand of hands) {
        const table = parseTournamentGameId(hand.game_id);
        if (!hasValue(table) || table.tournamentId.toLowerCase() !== key) continue;
        if (!isNumber(hand.block_height) || !Number.isSafeInteger(hand.block_height) || hand.block_height < joinBlock) continue;
        if (!hasValue(best) || hand.block_height > best) best = hand.block_height;
    }
    return best;
}

export function coversTournament(gameId: string, tournamentId: string): boolean {
    const key = tournamentId.toLowerCase();
    if (gameId.toLowerCase() === key) return true;
    const table = parseTournamentGameId(gameId);
    return hasValue(table) && table.tournamentId.toLowerCase() === key;
}

/**
 * Cash-out for a history row: a paid finish wins, otherwise an unregister refund.
 * A bust (payout 0) stays unset so the bust cell can show the place.
 */
export function tournamentSessionCashOut(entry: PlayerTournamentEntry, player: string): number | undefined {
    const prize = paidCashOut(entry, player);
    if (hasValue(prize)) return prize;
    return hasValue(entry.refund) ? entry.refund : undefined;
}

/**
 * Attach the latest unregister refund that happened at or after this entry's
 * registration. A finished tournament keeps its result; the refund is still
 * counted in the profile totals from the unregistration list.
 */
export function withTournamentRefunds(
    entries: PlayerTournamentEntry[],
    unregistrations: TournamentUnregistration[]
): PlayerTournamentEntry[] {
    if (isEmpty(unregistrations)) return entries;
    const latest = new Map<string, TournamentUnregistration>();
    const ordered = [...unregistrations].sort(
        (a, b) => a.height - b.height || a.txhash.localeCompare(b.txhash) || a.tournamentId.localeCompare(b.tournamentId)
    );
    for (const unreg of ordered) {
        latest.set(unreg.tournamentId.toLowerCase(), unreg);
    }
    return entries.map(entry => {
        const unreg = latest.get(entry.tournamentId.toLowerCase());
        if (!hasValue(unreg) || unreg.height < entry.registerHeight) return entry;
        if (entry.status === "finished") return entry;
        const next: PlayerTournamentEntry = { ...entry, unregisterHeight: unreg.height };
        if (hasValue(unreg.refund)) next.refund = unreg.refund;
        return next;
    });
}

/** Successful `tournament_unregistered` events in a GetTxsEvent body, grouped by lowercase player. */
export function tournamentUnregistrationsByPlayer(body: unknown): Map<string, TournamentUnregistration[]> {
    const grouped = new Map<string, TournamentUnregistration[]>();
    if (!isRecord(body) || !Array.isArray(body.tx_responses)) return grouped;
    for (const tx of body.tx_responses) {
        if (!isRecord(tx) || !txSucceeded(tx) || !isString(tx.txhash) || !hasContent(tx.txhash)) continue;
        const height = txHeight(tx);
        if (!hasValue(height) || !Array.isArray(tx.events)) continue;
        for (const event of tx.events) {
            if (!isRecord(event) || event.type !== "tournament_unregistered") continue;
            const fields = attributesOf(event);
            if (!hasContent(fields.player) || !hasContent(fields.tournament_id) || !TOURNAMENT_ID.test(fields.tournament_id)) continue;
            const player = fields.player.toLowerCase();
            const unreg: TournamentUnregistration = { tournamentId: fields.tournament_id, height, txhash: tx.txhash };
            const refund = eventMicro(fields.refund);
            if (hasValue(refund)) unreg.refund = refund;
            const list = grouped.get(player) ?? [];
            list.push(unreg);
            grouped.set(player, list);
        }
    }
    return grouped;
}

/** Successful `tournament_unregistered` events for `player` in a GetTxsEvent body. */
export function tournamentUnregistrationsFromTxSearch(body: unknown, player: string): TournamentUnregistration[] {
    if (!hasContent(player)) return [];
    return tournamentUnregistrationsByPlayer(body).get(player.toLowerCase()) ?? [];
}

/** Tournament ids in first-seen order, compared case-insensitively. */
export function uniqueTournamentIds(registrations: Iterable<TournamentRegistration>): string[] {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const registration of registrations) {
        const key = registration.tournamentId.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        ids.push(registration.tournamentId);
    }
    return ids;
}

/**
 * History entries for each player who registered, from tournament records and
 * unregister refunds. A registration whose record is missing is skipped; buy-in
 * totals can still use the event amounts on that registration.
 */
export function tournamentEntriesByPlayer(
    registrationsByPlayer: Map<string, TournamentRegistration[]>,
    recordsById: Map<string, TournamentStateDTO>,
    unregistrationsByPlayer: Map<string, TournamentUnregistration[]>
): Map<string, PlayerTournamentEntry[]> {
    const out = new Map<string, PlayerTournamentEntry[]>();
    registrationsByPlayer.forEach((registrations, player) => {
        const entries: PlayerTournamentEntry[] = [];
        for (const registration of earliestRegistrations(registrations)) {
            const record = recordsById.get(registration.tournamentId.toLowerCase());
            if (!hasValue(record)) continue;
            const entry = tournamentEntryFromRegistration(registration, record, player);
            if (hasValue(entry)) entries.push(entry);
        }
        out.set(player, withTournamentRefunds(entries, unregistrationsByPlayer.get(player) ?? []));
    });
    return out;
}

function tournamentSessionRow(entry: PlayerTournamentEntry, hands: readonly HandBlock[], player: string): SessionPrizeRow {
    const cashOut = tournamentSessionCashOut(entry, player);
    const leave = lastTournamentHandBlock(hands, entry.tournamentId, entry.registerHeight);
    // A zero payout stays off the row. sessionBustFor only labels an open seat,
    // and the leave block for that seat is filled in beside the row.
    const unpaidFinish = !hasValue(cashOut) && unpaidResult(entry, player);
    const row: SessionPrizeRow = {
        gameId: entry.gameId,
        joinBlock: entry.registerHeight,
        buyIn: entry.buyIn,
        isPrize: false
    };
    if (!unpaidFinish && hasValue(leave)) row.leaveBlock = leave;
    if (hasValue(cashOut)) row.cashOut = cashOut;
    return row;
}

/**
 * Indexer rows plus one row per tournament the indexer doesn't already list.
 * A session whose game id is the tournament, or any `<tournamentId>-t<n>` table,
 * counts as already listed. New rows sit in join-block order (newest first,
 * which is the indexer's order).
 */
export function mergeTournamentSessionRows(
    rows: SessionPrizeRow[],
    entries: PlayerTournamentEntry[],
    hands: readonly HandBlock[],
    player: string | undefined
): SessionPrizeRow[] {
    if (!hasContent(player) || isEmpty(entries)) return rows;
    const fresh = entries.filter(entry => !rows.some(row => coversTournament(row.gameId, entry.tournamentId)));
    const merged = [...rows];
    const ordered = [...fresh].sort((a, b) => b.registerHeight - a.registerHeight || a.tournamentId.localeCompare(b.tournamentId));
    for (const entry of ordered) {
        const row = tournamentSessionRow(entry, hands, player);
        const index = merged.findIndex(existing => existing.joinBlock < row.joinBlock);
        if (index < 0) merged.push(row);
        else merged.splice(index, 0, row);
    }
    return merged;
}

function labelMeta(source: GamePrizeMeta): GamePrizeMeta {
    const copy: GamePrizeMeta = {};
    if (hasValue(source.format)) copy.format = source.format;
    if (hasContent(source.variant)) copy.variant = source.variant;
    if (hasContent(source.bettingLimit)) copy.bettingLimit = source.bettingLimit;
    if (hasContent(source.minBuyIn)) copy.minBuyIn = source.minBuyIn;
    if (hasContent(source.maxBuyIn)) copy.maxBuyIn = source.maxBuyIn;
    return copy;
}

/**
 * Game records the session table already loaded, plus the tournament's results
 * and buy-in on the row's table.
 *
 * The table record's results are the seats at that table, not the tournament
 * standings, and its min buy-in is 0 (stacks are chips). The entry's results
 * are what the bust cell reads, and the buy-in plus entry fee is the stake the
 * label shows instead of "$0.00 buy-in". A hand on another table of the same
 * tournament borrows the label when that table's own record hasn't loaded.
 */
export function sessionMetasWithTournamentEntries(
    metas: Record<string, GamePrizeMeta | undefined>,
    entries: PlayerTournamentEntry[],
    hands: readonly Pick<PlayerHand, "game_id">[] = []
): Record<string, GamePrizeMeta | undefined> {
    if (isEmpty(entries)) return metas;
    const out: Record<string, GamePrizeMeta | undefined> = { ...metas };
    for (const entry of entries) {
        const current = out[entry.gameId] ?? {};
        const stake = !hasContent(current.minBuyIn) || current.minBuyIn === "0" ? String(entry.buyIn) : undefined;
        out[entry.gameId] = {
            ...current,
            format: hasValue(current.format) ? current.format : "tournament",
            ...(hasElements(entry.results) ? { results: entry.results } : {}),
            ...(hasContent(stake) ? { minBuyIn: stake, maxBuyIn: stake } : {})
        };
    }
    for (const hand of hands) {
        const existing = out[hand.game_id];
        if (hasValue(existing) && hasValue(existing.format)) continue;
        const entry = entries.find(item => sameTournamentSession(item.gameId, hand.game_id));
        if (!hasValue(entry)) continue;
        const source = out[entry.gameId];
        if (!hasValue(source) || !hasValue(source.format)) continue;
        const variant = hasValue(existing) && hasContent(existing.variant) ? existing.variant : source.variant;
        out[hand.game_id] = { ...labelMeta(source), ...existing, format: source.format, variant };
    }
    return out;
}

/**
 * "6th" from the tournament results on an MTT table. Undefined for any other
 * game, so a cash or sit-and-go row keeps the place it already shows.
 */
export function tournamentFinishPlaceLabel(gameId: string, meta: GamePrizeMeta | undefined, player: string | undefined): string | undefined {
    if (!hasValue(parseTournamentGameId(gameId)) || !hasValue(meta) || !hasContent(player) || !hasElements(meta.results)) return undefined;
    const mine = ownResult(meta.results, player);
    if (!hasValue(mine)) return undefined;
    const ordinal = placeOrdinal(mine.place);
    return hasContent(ordinal) ? ordinal : undefined;
}

/**
 * Leave blocks the table already found, filled in from indexed hands when a
 * tournament table doesn't have one yet. A number the chain search already
 * returned is kept.
 */
export function withTournamentHandLeaveBlocks(
    blocks: Record<string, number | null | undefined>,
    entries: PlayerTournamentEntry[],
    hands: readonly HandBlock[]
): Record<string, number | null | undefined> {
    if (isEmpty(entries)) return blocks;
    const out: Record<string, number | null | undefined> = { ...blocks };
    for (const entry of entries) {
        if (isNumber(out[entry.gameId])) continue;
        const block = lastTournamentHandBlock(hands, entry.tournamentId, entry.registerHeight);
        if (!hasValue(block)) continue;
        out[entry.gameId] = block;
    }
    return out;
}
