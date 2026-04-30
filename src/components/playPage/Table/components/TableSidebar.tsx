/**
 * TableSidebar Component
 *
 * Displays the actions log sidebar that can be toggled open/closed.
 * Shows the history of game actions.
 */

import React from "react";
import ActionsLog from "../../../ActionsLog";

export interface TableSidebarProps {
    isOpen: boolean;
}

export const TableSidebar: React.FC<TableSidebarProps> = ({ isOpen }) => {
    return (
        <div className={`action-log-overlay ${isOpen ? "action-log-open" : "action-log-closed"}`}>
            <div className="h-full bg-[#1a2234] border-l border-white/10 flex flex-col overflow-hidden">
                <ActionsLog />
            </div>
        </div>
    );
};
