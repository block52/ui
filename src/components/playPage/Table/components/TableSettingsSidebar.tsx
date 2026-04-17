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
            <p className="text-white text-sm font-semibold leading-tight">{label}</p>
            <p className="text-gray-400 text-xs mt-0.5 leading-snug">{description}</p>
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
    } = useGameSettings();

    return (
        <div className={`action-log-overlay ${isOpen ? "action-log-open settings-panel-width" : "action-log-closed"}`}>
            <div className="h-full bg-[#1a2234] border-l border-white/10 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center px-4 py-3 border-b border-white/10 flex-shrink-0">
                    <span className="text-white font-bold text-base">Settings</span>
                </div>

                {/* Toggle list */}
                <div className="flex-1 overflow-y-auto px-4 py-1">
                    <ToggleRow
                        label="Auto Deal"
                        description="Automatically deal cards at the start of each hand when it is your turn."
                        checked={autoDeal}
                        onToggle={toggleAutoDeal}
                    />
                    <ToggleRow
                        label="Auto Post Blinds"
                        description="Automatically post small and big blinds without manual confirmation."
                        checked={autoPostBlinds}
                        onToggle={toggleAutoPostBlinds}
                    />
                    <ToggleRow
                        label="Auto New Hand"
                        description="Automatically start a new hand after the current hand ends."
                        checked={autoNewHand}
                        onToggle={toggleAutoNewHand}
                    />
                    <ToggleRow
                        label="Auto Fold on Timeout"
                        description="Automatically fold (or check if available) when your action timer runs out."
                        checked={autoFold}
                        onToggle={toggleAutoFold}
                    />
                    <ToggleRow
                        label="Turn Notification Sound"
                        description="Play a sound and flash the browser tab when it is your turn to act."
                        checked={turnNotificationSound}
                        onToggle={toggleTurnNotificationSound}
                    />
                </div>
            </div>
        </div>
    );
};
