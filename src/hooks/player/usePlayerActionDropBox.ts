import { useState, useEffect, useMemo, useRef } from "react";
import { useGameProgress } from "../game/useGameProgress";
import { PlayerActionType, NonPlayerActionType } from "@block52/poker-vm-sdk";
import { formatUSDCToSimpleDollars } from "../../utils/numberUtils";

export interface PlayerActionDisplay {
  action: string;
  amount?: string;
  isVisible: boolean;
  isTextHiding: boolean;
  isAnimatingOut: boolean;
}

const TEXT_HIDE_DURATION = 150;
const EXIT_ANIMATION_DURATION = 500;

// Map action types to display text using the actual enum values
const ACTION_DISPLAY_MAP: Record<string, string> = {
  // Use PlayerActionType enum values
  [PlayerActionType.BET]: "BET",
  [PlayerActionType.CALL]: "CALL",
  [PlayerActionType.RAISE]: "RAISE",
  [PlayerActionType.FOLD]: "FOLD",
  [PlayerActionType.ALL_IN]: "ALL IN",
  [PlayerActionType.SMALL_BLIND]: "POST SB",
  [PlayerActionType.BIG_BLIND]: "POST BB",
  [PlayerActionType.CHECK]: "CHECK",
  [PlayerActionType.SHOW]: "SHOW",
  [PlayerActionType.MUCK]: "MUCK",
  [NonPlayerActionType.SIT_OUT]: "SITTING OUT",
  [NonPlayerActionType.SIT_IN]: "SIT IN",

  // Non-player actions - we'll filter these out mostly
  "join": "JOINED",
  "leave": "LEFT",
  "deal": "DEAL",
  "new-hand": "NEW HAND",

  // Status indicators (for potential future use)
  "winner": "WINNER"
};

// Actions that should NOT trigger the display (too frequent/not relevant)
const FILTERED_ACTIONS = ["join", "deal", "new-hand"];

// Format amount for display
const formatActionAmount = (_action: string, amount?: string): string => {
  if (!amount || amount === "0") return "";

  const numAmount = parseFloat(amount);
  if (numAmount === 0) return "";

  // Convert from USDC micro format (6 decimals) to readable format
  const formatted = formatUSDCToSimpleDollars(amount);
  return ` $${formatted}`;
};

export const usePlayerActionDropBox = (seatIndex: number): PlayerActionDisplay => {
  // Use the same pattern as useGameProgress
  const { previousActions, handNumber, actionCount: _actionCount } = useGameProgress();

  const [displayState, setDisplayState] = useState<PlayerActionDisplay>({
    action: "",
    amount: "",
    isVisible: false,
    isTextHiding: false,
    isAnimatingOut: false
  });

  // Track the last action we processed to detect new ones
  const lastProcessedActionRef = useRef<string | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Performance optimization: Cache the most recent action index to avoid recalculating
  const mostRecentActionIndex = useMemo(() => {
    if (!previousActions || previousActions.length === 0) return -1;

    // Find the highest index efficiently
    return Math.max(...previousActions.map(action => action.index));
  }, [previousActions]);

  // Get the GLOBALLY most recent action and check if it belongs to this player
  const latestAction = useMemo(() => {
    if (!previousActions || previousActions.length === 0 || mostRecentActionIndex === -1) return null;

    // Find the action with the most recent index
    const globallyMostRecentAction = previousActions.find(action => action.index === mostRecentActionIndex) || null;

    // Check if the most recent action should be filtered (not displayed)
    const shouldFilter = globallyMostRecentAction && FILTERED_ACTIONS.includes(globallyMostRecentAction.action.toLowerCase());

    // If we should filter this action, don't show anything
    const actionToShow = shouldFilter ? null : globallyMostRecentAction;

    // Only return the action if it should be shown AND was performed by THIS player
    const isThisPlayerLatest = actionToShow?.seat === seatIndex;
    return isThisPlayerLatest ? actionToShow : null;
  }, [previousActions, mostRecentActionIndex, seatIndex]);

  // Create a unique key for the action to detect changes
  const actionKey = useMemo(() => {
    if (!latestAction) return null;
    return `${latestAction.seat}-${latestAction.action}-${latestAction.amount}-${latestAction.timestamp}-${handNumber}`;
  }, [latestAction, handNumber]);

  // Memoize display values to prevent recalculation
  const displayValues = useMemo(() => {
    if (!latestAction) return null;
    return {
      action: ACTION_DISPLAY_MAP[latestAction.action] || latestAction.action.toUpperCase(),
      amount: formatActionAmount(latestAction.action, latestAction.amount)
    };
  }, [latestAction]);

  useEffect(() => {
    // Clear any existing timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // If no action, hide the display
    if (!latestAction || !actionKey || !displayValues) {
      setDisplayState({
        action: "",
        amount: "",
        isVisible: false,
        isTextHiding: false,
        isAnimatingOut: false
      });
      lastProcessedActionRef.current = null;
      return;
    }

    // Check if this is a new action we haven't processed yet
    if (lastProcessedActionRef.current !== actionKey) {
      lastProcessedActionRef.current = actionKey;

      // Show the action immediately using memoized values
      setDisplayState({
        action: displayValues.action,
        amount: displayValues.amount,
        isVisible: true,
        isTextHiding: false,
        isAnimatingOut: false
      });

      // Set timeout to hide after 2 seconds
      hideTimeoutRef.current = setTimeout(() => {
        setDisplayState(prev => ({
          ...prev,
          isTextHiding: true
        }));

        setTimeout(() => {
        setDisplayState(prev => ({
          ...prev,
          isAnimatingOut: true
        }));

        // Fully hide after animation completes (500ms animation)
        setTimeout(() => {
          setDisplayState({
            action: "",
            amount: "",
            isVisible: false,
            isTextHiding: false,
            isAnimatingOut: false
          });
        }, EXIT_ANIMATION_DURATION);
        }, TEXT_HIDE_DURATION);
      }, 2000);
    }
  }, [actionKey, displayValues, latestAction]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return displayState;
}; 