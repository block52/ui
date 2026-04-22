/**
 * TableSettingsSidebar Component
 *
 * Displays a settings panel that can be toggled open/closed.
 * Contains toggle switches for in-game options.
 */

import React from "react";
import { useGameSettings } from "../../../../context/GameSettingsContext";

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

export interface TableSettingsSidebarProps {
    isOpen: boolean;
}

export const TableSettingsSidebar: React.FC<TableSettingsSidebarProps> = ({ isOpen }) => {
    const {
        turnNotificationSound,
        playerActionSounds,
        toggleTurnNotificationSound,
        togglePlayerActionSounds
    } = useGameSettings();

    return (
        <div className={`action-log-overlay ${isOpen ? "action-log-open settings-panel-width" : "action-log-closed"}`}>
            <div className="h-full bg-[#1a2234] border-l border-white/10 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center px-4 py-3 border-b border-white/10 flex-shrink-0">
                    <span className="text-white font-semibold text-sm">Settings</span>
                </div>

                {/* Toggle list */}
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
                </div>
            </div>
        </div>
    );
};
