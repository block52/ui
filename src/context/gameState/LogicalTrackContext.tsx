import { createContext, useContext } from "react";
import { defaultLogicalTrack, type LogicalTrack } from "../../hooks/playerActions/transportAction";

/**
 * The table's LOGICAL track (ui#834): the freshest ingested snapshot, which
 * every submission decision reads. GameStateProvider creates one per instance
 * and provides it here, so with several tables mounted (multi-tabling, ui#55)
 * each table's submit controller and auto-action hooks read only their own
 * table's state.
 *
 * Outside any GameStateProvider this falls back to the default track.
 */
const LogicalTrackContext = createContext<LogicalTrack>(defaultLogicalTrack);

export const LogicalTrackProvider = LogicalTrackContext.Provider;

export const useLogicalTrack = (): LogicalTrack => useContext(LogicalTrackContext);
