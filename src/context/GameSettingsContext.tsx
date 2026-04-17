/**
 * GameSettingsContext
 *
 * Provides reactive game settings that are persisted in localStorage.
 * Settings can be toggled at runtime from the settings sidebar panel.
 *
 * Falls back to URL query params for initial values if no localStorage
 * value is present, preserving backwards compatibility.
 */

import React, { createContext, useContext, useState, useCallback } from "react";
import { getAutoDealEnabled, getAutoPostBlindsEnabled, getAutoNewHandEnabled, getAutoFoldEnabled } from "../utils/urlParams";

const LS_KEY_AUTO_DEAL = "setting_autodeal";
const LS_KEY_AUTO_POST_BLINDS = "setting_autoblinds";
const LS_KEY_AUTO_NEW_HAND = "setting_autonewhand";
const LS_KEY_AUTO_FOLD = "setting_autofold";
const LS_KEY_TURN_SOUND = "setting_turnsound";

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
    turnNotificationSound: boolean;
}

export interface GameSettingsContextValue extends GameSettings {
    toggleAutoDeal: () => void;
    toggleAutoPostBlinds: () => void;
    toggleAutoNewHand: () => void;
    toggleAutoFold: () => void;
    toggleTurnNotificationSound: () => void;
}

const GameSettingsContext = createContext<GameSettingsContextValue>(null as any);

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
    const [turnNotificationSound, setTurnNotificationSound] = useState<boolean>(() =>
        readBoolSetting(LS_KEY_TURN_SOUND, true)
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

    const toggleTurnNotificationSound = useCallback(() => {
        setTurnNotificationSound(prev => {
            const next = !prev;
            localStorage.setItem(LS_KEY_TURN_SOUND, String(next));
            return next;
        });
    }, []);

    return (
        <GameSettingsContext.Provider
            value={{
                autoDeal,
                autoPostBlinds,
                autoNewHand,
                autoFold,
                turnNotificationSound,
                toggleAutoDeal,
                toggleAutoPostBlinds,
                toggleAutoNewHand,
                toggleAutoFold,
                toggleTurnNotificationSound
            }}
        >
            {children}
        </GameSettingsContext.Provider>
    );
};

export const useGameSettings = (): GameSettingsContextValue => useContext(GameSettingsContext);
