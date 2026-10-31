import { createContext, useContext } from "react";
import type { LogicalTrack } from "../../hooks/playerActions/transportAction";
import { isNullish } from "../../utils/guards";

/**
 * The table's LOGICAL track (ui#834): the freshest ingested snapshot, which
 * every submission decision reads. GameStateProvider creates one per instance
 * and provides it here, so with several tables mounted (multi-tabling, ui#55)
 * each table's submit controller and auto-action hooks read only their own
 * table's state.
 *
 * There is no default track (Commandment 7): a reader mounted outside a
 * GameStateProvider would see a track nothing ever writes to, so its actions
 * would stall silently. useLogicalTrack throws instead. Tests that need a
 * track wrap in `<LogicalTrackProvider value={createLogicalTrack()}>`.
 */
const LogicalTrackContext = createContext<LogicalTrack | null>(null);

export const LogicalTrackProvider = LogicalTrackContext.Provider;

export const useLogicalTrack = (): LogicalTrack => {
    const track = useContext(LogicalTrackContext);
    if (isNullish(track)) {
        throw new Error("useLogicalTrack must be used inside a GameStateProvider (or a LogicalTrackProvider).");
    }
    return track;
};
