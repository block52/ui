import { hasContent } from "./guards";

/** A directed table's game id: `<tournamentId>-t<n>`, the tournament id a 0x hash. */
const TOURNAMENT_TABLE_ID = /^0x([0-9a-fA-F]+)-t(\d+)$/;

/** Hex characters of the tournament id shown in a table title. */
export const TOURNAMENT_SHORT_ID_LENGTH = 4;

/**
 * The title shown for a table: its own name when it has one, otherwise
 * `Table <short tournament id>/<table number>` for a multi-table tournament
 * table (`0xface4d…-t1` -> "Table face/1"), otherwise `Table` and the last five
 * characters of the id, as before.
 */
export const tableTitle = (tableId: string | undefined, tableName?: string): string => {
    if (hasContent(tableName)) return tableName;
    if (!hasContent(tableId)) return "Table ";
    const tournament = TOURNAMENT_TABLE_ID.exec(tableId);
    if (tournament) return `Table ${tournament[1].slice(0, TOURNAMENT_SHORT_ID_LENGTH).toLowerCase()}/${Number(tournament[2])}`;
    return `Table ${tableId.slice(-5)}`;
};
