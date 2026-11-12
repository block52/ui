/**
 * The ONE place that turns a game id into a table route. Every link or
 * navigation to a table (tournament tables included) must use it, so a route
 * change (e.g. /tournament/<id>/table/<n>) is a one-file change.
 */
export const tableUrl = (gameId: string): string => `/table/${gameId}`;
