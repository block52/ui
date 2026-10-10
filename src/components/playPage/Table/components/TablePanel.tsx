/**
 * TablePanel Component
 *
 * The single docked side panel for the play page. Replaces the two separate
 * fly-out overlays (action log + settings) with one panel that has two tabs:
 * History (the action log) and Settings (in-game toggles).
 *
 * History is the default tab. The inactive tab's content is UNMOUNTED (not
 * hidden with width:0), so its controls are never focusable or screen-reader
 * reachable while hidden — preserving the a11y fix the old overlays carried.
 */

import React from "react";
import ActionsLog from "../../../ActionsLog";
import { useGameSettings } from "../../../../context/GameSettingsContext";

export type TablePanelTab = "history" | "settings";

interface ToggleRowProps {
    label: string;
    description: string;
    checked: boolean;
    onToggle: () => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onToggle }) => (
    <div className="flex items-start justify-between py-3 border-b border-white/10 last:border-0">
        <div className="flex-1 mr-3">
            <p className="text-white text-xs font-semibold leading-tight">{label}</p>
            <p className="text-gray-400 text-[10px] mt-0.5 leading-snug">{description}</p>
        </div>
        <button
            role="switch"
            aria-checked={checked}
            onClick={onToggle}
            className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-transparent ${
                checked ? "bg-blue-500" : "bg-gray-600"
            }`}
            title={checked ? "Enabled — click to disable" : "Disabled — click to enable"}
        >
            <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    checked ? "translate-x-5" : "translate-x-0"
                }`}
            />
        </button>
    </div>
);

const SettingsTab: React.FC = () => {
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
        <div className="flex-1 overflow-y-auto px-4 py-1">
            <ToggleRow
                label="Turn Notification Sound"
                description="Play a sound and flash the browser tab when it is your turn to act."
                checked={turnNotificationSound}
                onToggle={toggleTurnNotificationSound}
            />
            <ToggleRow
                label="Player Action Sounds"
                description="Play sounds when players perform actions such as bet, raise, call, fold, and check."
                checked={playerActionSounds}
                onToggle={togglePlayerActionSounds}
            />
            <ToggleRow
                label="Auto Muck"
                description="Automatically muck losing cards at showdown without prompting."
                checked={autoMuck}
                onToggle={toggleAutoMuck}
            />
            <ToggleRow
                label="Sit-In Options"
                description="Choose how to enter (Sit In Next Hand vs Next Big Blind) when you take a seat. When off, you're sat in automatically and dealt in next hand."
                checked={sitInOptions}
                onToggle={toggleSitInOptions}
            />
            <ToggleRow
                label="Pre-Select Check"
                description="Show a Check box before your turn when checking is free, so you can queue an auto-check. Clears if a bet lands — it can only ever check, never fold."
                checked={preSelectCheck}
                onToggle={togglePreSelectCheck}
            />
        </div>
    );
};

export interface TablePanelProps {
    activeTab: TablePanelTab;
    onSelectTab: (tab: TablePanelTab) => void;
}

const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
    <button
        role="tab"
        aria-selected={active}
        onClick={onClick}
        className={`flex-1 px-4 py-2.5 text-xs font-semibold transition-colors duration-200 focus:outline-none ${
            active ? "text-white border-b-2 border-blue-500" : "text-gray-400 border-b-2 border-transparent hover:text-white"
        }`}
    >
        {label}
    </button>
);

export const TablePanel: React.FC<TablePanelProps> = ({ activeTab, onSelectTab }) => {
    return (
        <div className="table-panel">
            <div className="h-full bg-[#1a2234] rounded-xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
                {/* Tab bar — carries the panel label; History first, then Settings. */}
                <div role="tablist" className="flex items-center border-b border-white/10 flex-shrink-0">
                    <TabButton label="History" active={activeTab === "history"} onClick={() => onSelectTab("history")} />
                    <TabButton label="Settings" active={activeTab === "settings"} onClick={() => onSelectTab("settings")} />
                </div>

                {/* Inactive tab content is unmounted, not hidden. */}
                {activeTab === "history" ? <ActionsLog /> : <SettingsTab />}
            </div>
        </div>
    );
};
