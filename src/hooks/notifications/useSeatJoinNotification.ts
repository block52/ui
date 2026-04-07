import { useState, useEffect, useRef } from "react";

export interface SeatJoinNotification {
  seatNumber: number;
  isVisible: boolean;
  isTextHiding: boolean;
  isAnimatingOut: boolean;
}

const DISPLAY_DURATION = 2000; // 2 seconds
const TEXT_HIDE_DURATION = 150; // 0.15 seconds
const EXIT_ANIMATION_DURATION = 500; // 0.5 seconds

/**
 * Hook to manage seat join notifications that appear below the player's badge
 * Similar to usePlayerActionDropBox but specifically for seat join events
 */
export function useSeatJoinNotification(seatNumber: number): SeatJoinNotification {
  const [isVisible, setIsVisible] = useState(false);
  const [isTextHiding, setIsTextHiding] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const displayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const textHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastTriggerRef = useRef<number>(0);

  // Function to show notification (called when seat is joined)
  const showNotification = () => {
    const now = Date.now();
    
    // Clear any existing timers
    if (displayTimerRef.current) {
      clearTimeout(displayTimerRef.current);
    }
    if (textHideTimerRef.current) {
      clearTimeout(textHideTimerRef.current);
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
    }

    // Show the notification
    setIsVisible(true);
    setIsTextHiding(false);
    setIsAnimatingOut(false);
    lastTriggerRef.current = now;

    // Start exit animation after display duration
    displayTimerRef.current = setTimeout(() => {
      setIsTextHiding(true);

      textHideTimerRef.current = setTimeout(() => {
        setIsAnimatingOut(true);

        // Hide completely after exit animation
        exitTimerRef.current = setTimeout(() => {
          setIsVisible(false);
          setIsTextHiding(false);
          setIsAnimatingOut(false);
        }, EXIT_ANIMATION_DURATION);
      }, TEXT_HIDE_DURATION);
    }, DISPLAY_DURATION);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (displayTimerRef.current) {
        clearTimeout(displayTimerRef.current);
      }
      if (textHideTimerRef.current) {
        clearTimeout(textHideTimerRef.current);
      }
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  // Store the show function in window object so it can be triggered externally
  useEffect(() => {
    if (!window.seatJoinNotifications) {
      window.seatJoinNotifications = {};
    }
    window.seatJoinNotifications[seatNumber] = showNotification;

    return () => {
      if (window.seatJoinNotifications) {
        delete window.seatJoinNotifications[seatNumber];
      }
    };
  }, [seatNumber]);

  return {
    seatNumber,
    isVisible,
    isTextHiding,
    isAnimatingOut
  };
}

// Extend window interface for TypeScript
declare global {
  interface Window {
    seatJoinNotifications?: Record<number, () => void>;
  }
}
