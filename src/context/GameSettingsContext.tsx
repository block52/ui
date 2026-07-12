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
import { getAutoDealEnabled, getAutoPostBlindsEnabled, getAutoNewHandEnabled, getAutoFoldEnabled } from "../utils/urlParams";

const LS_KEY_AUTO_DEAL = "setting_autodeal";
const LS_KEY_AUTO_POST_BLINDS = "setting_autoblinds";
const LS_KEY_AUTO_NEW_HAND = "setting_autonewhand";
const LS_KEY_AUTO_FOLD = "setting_autofold";
const LS_KEY_AUTO_MUCK = "setting_automuck";
const LS_KEY_TURN_SOUND = "setting_turnsound";
const LS_KEY_PLAYER_ACTION_SOUNDS = "setting_playeractionsounds";
const LS_KEY_ACTION_HAPTICS = "setting_actionhaptics";
const LS_KEY_SEAT_AT_BOTTOM = "setting_seatatbottom";

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
    turnNotificationSound: boolean;
    playerActionSounds: boolean;
    actionHaptics: boolean;
    seatAtBottom: boolean;
}

export interface GameSettingsContextValue extends GameSettings {
    toggleAutoDeal: () => void;
    toggleAutoPostBlinds: () => void;
    toggleAutoNewHand: () => void;
    toggleAutoFold: () => void;
    toggleAutoMuck: () => void;
    toggleTurnNotificationSound: () => void;
    togglePlayerActionSounds: () => void;
    toggleActionHaptics: () => void;
    toggleSeatAtBottom: () => void;
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
    const [turnNotificationSound, setTurnNotificationSound] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_TURN_SOUND, true)
    );
    const [playerActionSounds, setPlayerActionSounds] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_PLAYER_ACTION_SOUNDS, true)
    );
    const [actionHaptics, setActionHaptics] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_ACTION_HAPTICS, true)
    );
    const [seatAtBottom, setSeatAtBottom] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_SEAT_AT_BOTTOM, true)
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

    const toggleActionHaptics = useCallback(() => {
        setActionHaptics(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_ACTION_HAPTICS, String(next));
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

    const value = useMemo<GameSettingsContextValue>(
        () => ({
            autoDeal,
            autoPostBlinds,
            autoNewHand,
            autoFold,
            autoMuck,
            turnNotificationSound,
            playerActionSounds,
            actionHaptics,
            seatAtBottom,
            toggleAutoDeal,
            toggleAutoPostBlinds,
            toggleAutoNewHand,
            toggleAutoFold,
            toggleAutoMuck,
            toggleTurnNotificationSound,
            togglePlayerActionSounds,
            toggleActionHaptics,
            toggleSeatAtBottom
        }),
        [
            autoDeal,
            autoPostBlinds,
            autoNewHand,
            autoFold,
            autoMuck,
            turnNotificationSound,
            playerActionSounds,
            actionHaptics,
            seatAtBottom,
            toggleAutoDeal,
            toggleAutoPostBlinds,
            toggleAutoNewHand,
            toggleAutoFold,
            toggleAutoMuck,
            toggleTurnNotificationSound,
            togglePlayerActionSounds,
            toggleActionHaptics,
            toggleSeatAtBottom
        ]
    );

    return <GameSettingsContext.Provider value={value}>{children}</GameSettingsContext.Provider>;
};

export const useGameSettings = (): GameSettingsContextValue => {
    const context = useContext(GameSettingsContext);
    if (!context) {
        throw new Error("useGameSettings must be used within a GameSettingsProvider");
    }
    return context;
};
