import type { MoveIntentDTO, TournamentStateDTO, TournamentTableDTO } from "../types/tournament";
import { isEmpty } from "./guards";
import { parseTournamentGameId, tournamentGameId } from "./tableUrl";
import { gameIdFromTableId } from "./tournamentFollow";

/** How long to keep the "being moved" notice on screen before following the new table. */
export const REBALANCE_MOVE_NOTICE_MS = 2000;

/** Engine hold while a scheduled blind-level break is in progress — not a rebalance. */
export const HOLD_BREAK = "break";
/** Engine hold while every live table waits to be redrawn onto the final table. */
export const HOLD_FINAL_TABLE = "final-table";

export const INTENT_BALANCE = "balance";
export const INTENT_BREAK = "break";

export type RebalanceNotice =
    | { kind: "waiting" }
    | { kind: "moving"; tableNumber: number; gameId: string };

const sameAddr = (a: string | undefined, b: string | undefined): boolean =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** Engine table id (`<tournamentId>/t1`) for a directed-table game id (`<tournamentId>-t1`). */
export const engineTableIdFromGameId = (gameId: string): string | undefined => {
    const ref = parseTournamentGameId(gameId);
    return ref ? `${ref.tournamentId}/t${ref.tableNumber}` : undefined;
};

/** The `tN` number in an engine table id or directed-table game id. */
export const tableNumberOf = (tableOrGameId: string): number | undefined => {
    const fromGame = parseTournamentGameId(tableOrGameId);
    if (fromGame) return fromGame.tableNumber;
    try {
        return parseTournamentGameId(gameIdFromTableId(tableOrGameId))?.tableNumber;
    } catch {
        return undefined;
    }
};

const viewedTable = (t: TournamentStateDTO, viewedGameId: string): TournamentTableDTO | undefined => {
    const tableId = engineTableIdFromGameId(viewedGameId);
    if (!tableId) return undefined;
    return t.tables.find(tbl => tbl.tableId === tableId);
};

const isRebalanceIntent = (intent: MoveIntentDTO): boolean => intent.reason === INTENT_BALANCE || intent.reason === INTENT_BREAK;

const intentsFor = (t: TournamentStateDTO, tableId: string): MoveIntentDTO[] =>
    (t.intents ?? []).filter(intent => isRebalanceIntent(intent) && (intent.from === tableId || intent.to === tableId));

/** Lowest-ordinal live table — the destination of a final-table redraw. */
const finalTableDestination = (t: TournamentStateDTO): TournamentTableDTO | undefined => {
    const live = t.tables.filter(tbl => !tbl.broken).sort((a, b) => a.ordinal - b.ordinal);
    return live[0];
};

const movingNotice = (tableId: string): RebalanceNotice | undefined => {
    const tableNumber = tableNumberOf(tableId);
    if (!tableNumber) return undefined;
    try {
        return { kind: "moving", tableNumber, gameId: gameIdFromTableId(tableId) };
    } catch {
        const ref = parseTournamentGameId(tableId);
        return ref ? { kind: "moving", tableNumber: ref.tableNumber, gameId: tournamentGameId(ref.tournamentId, ref.tableNumber) } : undefined;
    }
};

/**
 * Whether the viewed table should show a rebalance notice, and whether this
 * wallet is the one being moved.
 *
 * The director (pvm/go/engine/tournament_events.go) reserves moves in
 * `intents` and only starts the next hand once both ends are at a hand
 * boundary (`atBoundary`). A short table therefore sits at the boundary with
 * a pending intent until the other table finishes. `hold: "final-table"` is
 * the same pause while every live table waits to be redrawn onto one table.
 * `hold: "break"` is a scheduled level break and is not a rebalance.
 *
 * `pendingMove` covers the moment after the move has already executed (the
 * intent is gone, the wallet's table id has changed) and the UI is about to
 * follow it.
 */
export const rebalanceNotice = (
    tournament: TournamentStateDTO | undefined,
    viewedGameId: string | undefined,
    walletAddress: string | undefined,
    pendingMove?: { gameId: string; tableNumber: number }
): RebalanceNotice | undefined => {
    if (pendingMove) return { kind: "moving", tableNumber: pendingMove.tableNumber, gameId: pendingMove.gameId };
    if (!tournament || tournament.status !== "running" || !viewedGameId) return undefined;

    const table = viewedTable(tournament, viewedGameId);
    if (!table || table.broken) return undefined;
    // Mid-hand tables keep playing until they reach the boundary; don't cover them.
    if (!table.atBoundary) return undefined;
    if (table.hold === HOLD_BREAK) return undefined;

    if (table.hold === HOLD_FINAL_TABLE) {
        const dest = finalTableDestination(tournament);
        if (dest && dest.tableId !== table.tableId && walletAddress) {
            const me = tournament.entrants.find(e => sameAddr(e.address, walletAddress) && e.status === "playing" && e.tableId === table.tableId);
            if (me) {
                const notice = movingNotice(dest.tableId);
                if (notice) return notice;
            }
        }
        return { kind: "waiting" };
    }

    const named = intentsFor(tournament, table.tableId);
    if (isEmpty(named)) {
        // Short table at the boundary with no planned move yet (e.g. seats still
        // reserved): still waiting on a rebalance, not on the next hand.
        return table.players.length < 2 ? { kind: "waiting" } : undefined;
    }

    if (walletAddress) {
        const mine = named.find(intent => sameAddr(intent.address, walletAddress) && intent.from === table.tableId);
        if (mine) {
            const notice = movingNotice(mine.to);
            if (notice) return notice;
        }
    }

    return { kind: "waiting" };
};
