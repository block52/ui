/**
 * TableSidebar Component
 *
 * Displays the actions log sidebar that can be toggled open/closed.
 * Shows the history of game actions.
 */

import React from "react";
import ActionsLog from "../../../ActionsLog";
import styles from "./SidePanel.module.css";

export interface TableSidebarProps {
    isOpen: boolean;
}

export const TableSidebar: React.FC<TableSidebarProps> = ({ isOpen }) => {
    return (
        <div className={`action-log-overlay ${isOpen ? "action-log-open" : "action-log-closed"}`}>
            {/* Content is UNMOUNTED while closed. The closed container is width:0 +
                overflow:hidden, which hides the log visually but left its buttons in
                the DOM — focusable, screen-reader reachable, and rendering off-canvas
                past the viewport's right edge on phones. */}
            {isOpen && (
                <div className={`h-full bg-surface-card border-l border-line flex flex-col overflow-hidden ${styles.panel}`}>
                    <ActionsLog />
                </div>
            )}
        </div>
    );
};
