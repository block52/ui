import { useParams } from "react-router-dom";
import { gameIdFromRoute } from "../../utils/tableUrl";

/**
 * The game id of the table the current route shows. The table page is mounted
 * at `/table/:id` (cash, sit & go) and at `/tournament/:tournamentId/table/:n`
 * (a multi-table tournament's table); everything under it reads the id here
 * rather than from `useParams`, so it works under both.
 */
export const useTableId = (): string | undefined => gameIdFromRoute(useParams());
