import React from "react";
import { useGameSettings } from "../../../../context/GameSettingsContext";
import { SettingToggle } from "./SettingToggle";
import styles from "./SidePanel.module.css";

export interface TableSettingsSidebarProps {
    isOpen: boolean;
}

export const TableSettingsSidebar: React.FC<TableSettingsSidebarProps> = ({ isOpen }) => {
    const {
        turnNotificationSound,
        playerActionSounds,
        autoMuck,
        sitInOptions,
        preSelectCheck,
        toggleTurnNotificationSound,
        togglePlayerActionSounds,
        toggleAutoMuck,
        toggleSitInOptions,
        togglePreSelectCheck
    } = useGameSettings();

    return (
        <div className={`action-log-overlay ${isOpen ? "action-log-open settings-panel-width" : "action-log-closed"}`}>
            {/* Content is UNMOUNTED while closed. The closed container is width:0 +
                overflow:hidden, which hid the panel visually but left its five toggle
                switches in the DOM — focusable, screen-reader reachable, and rendering
                off-canvas past the viewport's right edge on phones. */}
            {isOpen && (
                <div className={`h-full bg-surface-card border-l border-line flex flex-col overflow-hidden ${styles.panel}`}>
                    <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-line px-4">
                        <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Settings</h3>
                    </div>

                    <div className={`flex-1 overflow-y-auto overflow-x-hidden p-3 ${styles.scroll}`}>
                        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface-raised/40">
                            <SettingToggle
                                label="Turn Notification Sound"
                                description="Play a sound and flash the browser tab when it is your turn to act."
                                checked={turnNotificationSound}
                                onToggle={toggleTurnNotificationSound}
                            />
                            <SettingToggle
                                label="Player Action Sounds"
                                description="Play sounds when players perform actions such as bet, raise, call, fold, and check."
                                checked={playerActionSounds}
                                onToggle={togglePlayerActionSounds}
                            />
                            <SettingToggle
                                label="Auto Muck"
                                description="Automatically muck losing cards at showdown without prompting."
                                checked={autoMuck}
                                onToggle={toggleAutoMuck}
                            />
                            <SettingToggle
                                label="Sit-In Options"
                                description="Choose how to enter (Sit In Next Hand vs Next Big Blind) when you take a seat. When off, you're sat in automatically and dealt in next hand."
                                checked={sitInOptions}
                                onToggle={toggleSitInOptions}
                            />
                            <SettingToggle
                                label="Pre-Select Check"
                                description="Show a Check box before your turn when checking is free, so you can queue an auto-check. Clears if a bet lands — it can only ever check, never fold."
                                checked={preSelectCheck}
                                onToggle={togglePreSelectCheck}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
