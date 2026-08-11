/**
 * Thin adapter over the holdem engine, preserving the names server.ts and
 * chain-ws.ts import. The seeded state + all mutation live in holdem.ts.
 */
export {
  CASH_GAME_ID,
  listGamesResponse,
  cosmosStateMessage,
  applyAction,
  resetTables,
  setStubConfig,
  getFrameDelayMs,
} from "./holdem.js";

import { getGameStateResponse } from "./holdem.js";

/** GameStateResponseDTO for a game, or undefined if unknown. */
export const getGameState = getGameStateResponse;
