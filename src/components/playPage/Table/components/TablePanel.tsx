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
import { FaChevronRight, FaTimes } from "react-icons/fa";
import ActionsLog from "../../../ActionsLog";
import { useGameSettings } from "../../../../context/GameSettingsContext";
import { CHIP_STYLES } from "../../../../config/chipSets";
import { LanguagePicker } from "../../../LanguagePicker";
import { useLanguage } from "../../../../i18n/useLanguage";

export type TablePanelTab = "history" | "settings";

interface ToggleRowProps {
    label: string;
    description: string;
    checked: boolean;
    onToggle: () => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onToggle }) => {
    const { t } = useLanguage();
    return (
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
                title={checked ? t("panel.enabled") : t("panel.disabled")}
            >
                <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                        checked ? "translate-x-5" : "translate-x-0"
                    }`}
                />
            </button>
        </div>
    );
};

interface ChoiceRowProps {
    label: string;
    description: string;
    options: readonly { id: string; label: string }[];
    value: string;
    onChange: (id: string) => void;
}

/** A setting with a few named options, shown as a segmented control. */
const ChoiceRow: React.FC<ChoiceRowProps> = ({ label, description, options, value, onChange }) => (
    <div className="py-3 border-b border-white/10 last:border-0">
        <p className="text-white text-xs font-semibold leading-tight">{label}</p>
        <p className="text-gray-400 text-[10px] mt-0.5 leading-snug">{description}</p>
        <div role="radiogroup" aria-label={label} className="mt-2 inline-flex rounded-full bg-gray-700/70 p-0.5">
            {options.map(option => (
                <button
                    key={option.id}
                    role="radio"
                    aria-checked={option.id === value}
                    onClick={() => onChange(option.id)}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        option.id === value ? "bg-blue-500 text-white" : "text-gray-300 hover:text-white"
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    </div>
);

const SettingsTab: React.FC = () => {
    const { t } = useLanguage();
    const {
        turnNotificationSound,
        playerActionSounds,
        stacksInBBCash,
        stacksInBBTournament,
        autoMuck,
        callClock,
        sitInOptions,
        preSelectCheck,
        winCelebration,
        potAsChips,
        chipStyle,
        toggleTurnNotificationSound,
        togglePlayerActionSounds,
        toggleStacksInBBCash,
        toggleStacksInBBTournament,
        toggleAutoMuck,
        toggleCallClock,
        toggleSitInOptions,
        togglePreSelectCheck,
        toggleWinCelebration,
        togglePotAsChips,
        setChipStyle
    } = useGameSettings();

    return (
        <div className="flex-1 overflow-y-auto px-4 py-1">
            <LanguagePicker variant="row" />
            <ToggleRow
                label={t("settings.turnSound")}
                description={t("settings.turnSoundHelp")}
                checked={turnNotificationSound}
                onToggle={toggleTurnNotificationSound}
            />
            <ToggleRow
                label={t("settings.actionSounds")}
                description={t("settings.actionSoundsHelp")}
                checked={playerActionSounds}
                onToggle={togglePlayerActionSounds}
            />
            <ToggleRow
                label={t("settings.bbCash")}
                description={t("settings.bbCashHelp")}
                checked={stacksInBBCash}
                onToggle={toggleStacksInBBCash}
            />
            <ToggleRow
                label={t("settings.bbTournament")}
                description={t("settings.bbTournamentHelp")}
                checked={stacksInBBTournament}
                onToggle={toggleStacksInBBTournament}
            />
            <ToggleRow
                label={t("settings.celebration")}
                description={t("settings.celebrationHelp")}
                checked={winCelebration}
                onToggle={toggleWinCelebration}
            />
            <ToggleRow
                label={t("settings.potChips")}
                description={t("settings.potChipsHelp")}
                checked={potAsChips}
                onToggle={togglePotAsChips}
            />
            <ChoiceRow
                label={t("settings.chips")}
                description={t("settings.chipsHelp")}
                options={CHIP_STYLES}
                value={chipStyle}
                onChange={setChipStyle}
            />
            <ToggleRow
                label={t("settings.autoMuck")}
                description={t("settings.autoMuckHelp")}
                checked={autoMuck}
                onToggle={toggleAutoMuck}
            />
            <ToggleRow
                label={t("settings.callClock")}
                description={t("settings.callClockHelp")}
                checked={callClock}
                onToggle={toggleCallClock}
            />
            <ToggleRow
                label={t("settings.sitIn")}
                description={t("settings.sitInHelp")}
                checked={sitInOptions}
                onToggle={toggleSitInOptions}
            />
            <ToggleRow
                label={t("settings.preSelect")}
                description={t("settings.preSelectHelp")}
                checked={preSelectCheck}
                onToggle={togglePreSelectCheck}
            />
        </div>
    );
};

export interface TablePanelProps {
    activeTab: TablePanelTab;
    onSelectTab: (tab: TablePanelTab) => void;
    /** Phones only: the panel opens from the hamburger menu and covers the felt,
     * so it needs its own close control. Omitted on desktop (always visible). */
    onClose?: () => void;
    /** Desktop only: tuck the panel away so it doesn't cover seats on the right. */
    onCollapse?: () => void;
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

/** Desktop: the slim tab shown on the right edge while the panel is collapsed. */
export const TablePanelExpandTab: React.FC<{ onExpand: () => void }> = ({ onExpand }) => {
    const { t } = useLanguage();
    return (
        <button onClick={onExpand} className="table-panel-expand" aria-label={t("panel.showAria")} title={t("panel.show")}>
            <FaChevronRight size={12} className="rotate-180" />
            <span className="table-panel-expand__label">{t("panel.history")}</span>
        </button>
    );
};

export const TablePanel: React.FC<TablePanelProps> = ({ activeTab, onSelectTab, onClose, onCollapse }) => {
    const { t } = useLanguage();
    return (
        <div className={onClose ? "table-panel table-panel--mobile" : "table-panel"}>
            <div className="h-full bg-[#1a2234] rounded-xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
                {/* Tab bar — carries the panel label; History first, then Settings. */}
                <div role="tablist" className="flex items-center border-b border-white/10 flex-shrink-0">
                    <TabButton label={t("panel.history")} active={activeTab === "history"} onClick={() => onSelectTab("history")} />
                    <TabButton label={t("panel.settings")} active={activeTab === "settings"} onClick={() => onSelectTab("settings")} />
                    {onCollapse && !onClose && (
                        <button
                            onClick={onCollapse}
                            className="w-11 h-11 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-white"
                            aria-label={t("panel.collapse")}
                            title={t("panel.collapse")}
                        >
                            <FaChevronRight size={12} />
                        </button>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="w-11 h-11 flex-shrink-0 flex items-center justify-center text-gray-400 hover:text-white"
                            aria-label={t("panel.close")}
                        >
                            <FaTimes size={14} />
                        </button>
                    )}
                </div>

                {/* Inactive tab content is unmounted, not hidden. */}
                {activeTab === "history" ? <ActionsLog /> : <SettingsTab />}
            </div>
        </div>
    );
};
