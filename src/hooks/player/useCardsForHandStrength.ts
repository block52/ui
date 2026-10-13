import { useMemo } from "react";
import { usePlayerData } from "./usePlayerData";
import { useTableData } from "../game/useTableData";
import { useGameMeta } from "../../context/gameState/GameMetaContext";
import { evaluateHandOrThrow } from "../../utils/handEvaluation";

export interface HandStrength {
  name: string;
  descr: string; // Obsolete, use description instead.  Was used in the old lib
  description: string;
  score: number;
  hand: string[]; // Your cards that make up the hand
}

export const useCardsForHandStrength = (seatIndex?: number): HandStrength | null => {
  const { holeCards } = usePlayerData(seatIndex);
  const { tableDataCommunityCards } = useTableData();
  const { gameVariant } = useGameMeta();

  // Key the evaluation on the CARDS, not on the arrays holding them. Both inputs
  // are rebuilt from a fresh `gameState` on every WS frame -- `holeCards` is
  // memoized on `playerData`, itself a new PlayerDTO per snapshot, and
  // `tableDataCommunityCards` is `gameState.communityCards` -- so keying on
  // identity re-ran Deck.fromString x7 plus a full hand evaluation several times
  // a second, on a component that is always mounted. The cards themselves only
  // change when a street is dealt.
  const holeKey = holeCards?.join(",") ?? "";
  const boardKey = tableDataCommunityCards?.join(",") ?? "";

  // holeCards/tableDataCommunityCards are deliberately not dependencies: the two
  // keys above encode their contents completely.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => {
    try {
      // Omaha uses exactly two hole cards and three board cards (ui#768).
      const evaluation = evaluateHandOrThrow(holeCards, tableDataCommunityCards, gameVariant);
      if (!evaluation) return null;
      return {
        name: evaluation.description,
        descr: evaluation.description,
        description: evaluation.description,
        score: evaluation.score,
        hand: evaluation.hand,
      };
    } catch (error) {
      console.error("Error calculating hand strength:", error);
      return null;
    }
  }, [holeKey, boardKey, gameVariant]);
};
