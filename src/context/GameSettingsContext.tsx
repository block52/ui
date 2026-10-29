/**
 * GameSettingsContext
 *
 * Provides reactive game settings that are persisted in localStorage.
 * Settings can be toggled at runtime from the settings sidebar panel.
 *
 * Falls back to URL query params for initial values if no localStorage
 * value is present, preserving backwards compatibility.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { findChipStyle } from "../config/chipSets";
import { getAutoDealEnabled, getAutoPostBlindsEnabled, getAutoNewHandEnabled, getAutoFoldEnabled, getCallClockEnabled } from "../utils/urlParams";

const LS_KEY_AUTO_DEAL = "setting_autodeal";
const LS_KEY_AUTO_POST_BLINDS = "setting_autoblinds";
const LS_KEY_AUTO_NEW_HAND = "setting_autonewhand";
const LS_KEY_AUTO_FOLD = "setting_autofold";
const LS_KEY_AUTO_MUCK = "setting_automuck";
const LS_KEY_CALL_CLOCK = "setting_callclock";
const LS_KEY_TURN_SOUND = "setting_turnsound";
const LS_KEY_PLAYER_ACTION_SOUNDS = "setting_playeractionsounds";
const LS_KEY_SEAT_AT_BOTTOM = "setting_seatatbottom";
const LS_KEY_SITIN_OPTIONS = "setting_sitinoptions";
const LS_KEY_PRE_SELECT_CHECK = "setting_preselectcheck";
const LS_KEY_WIN_CELEBRATION = "setting_wincelebration";
const LS_KEY_POT_AS_CHIPS = "setting_potaschips";
const LS_KEY_CHIP_STYLE = "setting_chipstyle";
const LS_KEY_SHOW_LEADERBOARD = "setting_showleaderboard";

function readBoolSetting(key: string, fallback: boolean): boolean {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    return stored === "true";
}

export interface GameSettings {
    autoDeal: boolean;
    autoPostBlinds: boolean;
    autoNewHand: boolean;
    autoFold: boolean;
    autoMuck: boolean;
    // When ON (default), this client calls the clock on an opponent whose turn
    // clock has run out and who has not acted (ui#819): it submits the chain's
    // `timeout` action, which the engine verifies before folding them. Observers
    // take turns from the dealer button, so one call lands per stalled turn.
    callClock: boolean;
    turnNotificationSound: boolean;
    playerActionSounds: boolean;
    seatAtBottom: boolean;
    // When OFF (default), taking a seat auto-sits-in (dealt in next hand). When ON,
    // the sit-in method radios are shown so the player chooses (ui#550/#551).
    sitInOptions: boolean;
    // When OFF (default), the pre-emptive "Check/Fold" box (ui#388) is hidden. When
    // ON, it appears before your turn while checking would be free, so you can queue
    // a Check/Fold (check if free, fold to a bet). Pure view/opt-in preference — the
    // queued intent itself stays ephemeral per-round.
    preSelectCheck: boolean;
    // When ON (default), the gold-chip win celebration plays on the winning seat
    // (ui#847). Turn OFF for a calmer table — the pot still awards, just without
    // the animation. Pairs with the winner banner (ui#848).
    winCelebration: boolean;
    // When OFF (default), the pot shows as plain "Total Pot: $x" text. When ON, it
    // shows as a chip stack + amount pill with a POT caption, matching the player
    // bets on the table (ui#772).
    potAsChips: boolean;
    // Which chip look to draw: an id from config/chipSets.ts (ui#842). Defaults to
    // the photoreal marble set; "notched" is the flat set, sharpest at small
    // sizes. Either way cash games show $/¢ chips and SNG/tournaments show point
    // chips.
    chipStyle: string;
    // When OFF (default), the live chip leaderboard is hidden. When ON, tournament
    // and sit-and-go tables show the standings overlay (rank, chips, % of chips in
    // play). The toggle is only surfaced for tournament/SNG formats — chip share is
    // meaningless for cash games (ui#280).
    showLeaderboard: boolean;
}

export interface GameSettingsContextValue extends GameSettings {
    toggleAutoDeal: () => void;
    toggleAutoPostBlinds: () => void;
    toggleAutoNewHand: () => void;
    toggleAutoFold: () => void;
    toggleAutoMuck: () => void;
    toggleCallClock: () => void;
    toggleTurnNotificationSound: () => void;
    togglePlayerActionSounds: () => void;
    toggleSeatAtBottom: () => void;
    toggleSitInOptions: () => void;
    togglePreSelectCheck: () => void;
    toggleWinCelebration: () => void;
    togglePotAsChips: () => void;
    setChipStyle: (id: string) => void;
    toggleShowLeaderboard: () => void;
}

const GameSettingsContext = createContext<GameSettingsContextValue | null>(null);

export const GameSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [autoDeal, setAutoDeal] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_AUTO_DEAL, getAutoDealEnabled())
    );
    const [autoPostBlinds, setAutoPostBlinds] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_AUTO_POST_BLINDS, getAutoPostBlindsEnabled())
    );
    const [autoNewHand, setAutoNewHand] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_AUTO_NEW_HAND, getAutoNewHandEnabled())
    );
    const [autoFold, setAutoFold] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_AUTO_FOLD, getAutoFoldEnabled())
    );
    const [autoMuck, setAutoMuck] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_AUTO_MUCK, false)
    );
    const [callClock, setCallClock] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_CALL_CLOCK, getCallClockEnabled())
    );
    const [turnNotificationSound, setTurnNotificationSound] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_TURN_SOUND, true)
    );
    const [playerActionSounds, setPlayerActionSounds] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_PLAYER_ACTION_SOUNDS, true)
    );
    const [seatAtBottom, setSeatAtBottom] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_SEAT_AT_BOTTOM, true)
    );
    const [sitInOptions, setSitInOptions] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_SITIN_OPTIONS, false)
    );
    const [preSelectCheck, setPreSelectCheck] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_PRE_SELECT_CHECK, false)
    );
    const [winCelebration, setWinCelebration] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_WIN_CELEBRATION, true)
    );
    const [potAsChips, setPotAsChips] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_POT_AS_CHIPS, false)
    );
    // An unknown or retired id falls back to the configured default.
    const [chipStyle, setChipStyleState] = useState<string>(() => findChipStyle(localStorage.getItem(LS_KEY_CHIP_STYLE)).id);
    const [showLeaderboard, setShowLeaderboard] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_SHOW_LEADERBOARD, false)
    );

    const toggleAutoDeal = useCallback(() => {
        setAutoDeal(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_AUTO_DEAL, String(next));
            return next;
        });
    }, []);

    const toggleAutoPostBlinds = useCallback(() => {
        setAutoPostBlinds(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_AUTO_POST_BLINDS, String(next));
            return next;
        });
    }, []);

    const toggleAutoNewHand = useCallback(() => {
        setAutoNewHand(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_AUTO_NEW_HAND, String(next));
            return next;
        });
    }, []);

    const toggleAutoFold = useCallback(() => {
        setAutoFold(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_AUTO_FOLD, String(next));
            return next;
        });
    }, []);

    const toggleAutoMuck = useCallback(() => {
        setAutoMuck(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_AUTO_MUCK, String(next));
            return next;
        });
    }, []);

    const toggleCallClock = useCallback(() => {
        setCallClock(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_CALL_CLOCK, String(next));
            return next;
        });
    }, []);

    const toggleTurnNotificationSound = useCallback(() => {
        setTurnNotificationSound(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_TURN_SOUND, String(next));
            return next;
        });
    }, []);

    const togglePlayerActionSounds = useCallback(() => {
        setPlayerActionSounds(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_PLAYER_ACTION_SOUNDS, String(next));
            return next;
        });
    }, []);

    const toggleSeatAtBottom = useCallback(() => {
        setSeatAtBottom(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_SEAT_AT_BOTTOM, String(next));
            return next;
        });
    }, []);

    const toggleSitInOptions = useCallback(() => {
        setSitInOptions(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_SITIN_OPTIONS, String(next));
            return next;
        });
    }, []);

    const togglePreSelectCheck = useCallback(() => {
        setPreSelectCheck(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_PRE_SELECT_CHECK, String(next));
            return next;
        });
    }, []);

    const toggleWinCelebration = useCallback(() => {
        setWinCelebration(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_WIN_CELEBRATION, String(next));
            return next;
        });
    }, []);

    const togglePotAsChips = useCallback(() => {
        setPotAsChips(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_POT_AS_CHIPS, String(next));
            return next;
        });
    }, []);

    const setChipStyle = useCallback((id: string) => {
        const next = findChipStyle(id).id;
        localStorage.setItem(LS_KEY_CHIP_STYLE, next);
        setChipStyleState(next);
    }, []);

    const toggleShowLeaderboard = useCallback(() => {
        setShowLeaderboard(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_SHOW_LEADERBOARD, String(next));
            return next;
        });
    }, []);

    const value = useMemo<GameSettingsContextValue>(
        () => ({
            autoDeal,
            autoPostBlinds,
            autoNewHand,
            autoFold,
            autoMuck,
            callClock,
            turnNotificationSound,
            playerActionSounds,
            seatAtBottom,
            sitInOptions,
            preSelectCheck,
            winCelebration,
            potAsChips,
            chipStyle,
            showLeaderboard,
            toggleAutoDeal,
            toggleAutoPostBlinds,
            toggleAutoNewHand,
            toggleAutoFold,
            toggleAutoMuck,
            toggleCallClock,
            toggleTurnNotificationSound,
            togglePlayerActionSounds,
            toggleSeatAtBottom,
            toggleSitInOptions,
            togglePreSelectCheck,
            toggleWinCelebration,
            togglePotAsChips,
            setChipStyle,
            toggleShowLeaderboard
        }),
        [
            autoDeal,
            autoPostBlinds,
            autoNewHand,
            autoFold,
            autoMuck,
            callClock,
            turnNotificationSound,
            playerActionSounds,
            seatAtBottom,
            sitInOptions,
            preSelectCheck,
            winCelebration,
            potAsChips,
            chipStyle,
            showLeaderboard,
            toggleAutoDeal,
            toggleAutoPostBlinds,
            toggleAutoNewHand,
            toggleAutoFold,
            toggleAutoMuck,
            toggleTurnNotificationSound,
            togglePlayerActionSounds,
            toggleSeatAtBottom,
            toggleSitInOptions,
            togglePreSelectCheck,
            toggleWinCelebration,
            togglePotAsChips,
            setChipStyle,
            toggleShowLeaderboard
        ]
    );

    return <GameSettingsContext.Provider value={value}>{children}</GameSettingsContext.Provider>;
};

/**
 * Which chip look to draw: a style id from config/chipSets.ts (ui#842). Safe
 * outside a GameSettingsProvider (e.g. a standalone chip preview), where it falls
 * back to the configured default.
 */
export const useChipStyle = (): string => {
    const context = useContext(GameSettingsContext);
    return context?.chipStyle ?? findChipStyle(null).id;
};

export const useGameSettings = (): GameSettingsContextValue => {
    const context = useContext(GameSettingsContext);
    if (!context) {
        throw new Error("useGameSettings must be used within a GameSettingsProvider");
    }
    return context;
};
