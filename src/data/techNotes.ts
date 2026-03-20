export type TechNoteCategory = "feature" | "fix" | "note" | "improvement";

export interface TechNote {
    id: string;
    title: string;
    date: string; // ISO date string, e.g. "2025-03-15"
    description: string;
    category: TechNoteCategory;
}

export const techNotes: TechNote[] = [
    {
        id: "2025-03-19-websocket-reconnect",
        title: "WebSocket Reconnection Improvements",
        date: "2025-03-19",
        description:
            "Improved WebSocket reconnection logic to handle network interruptions more gracefully. Clients now automatically re-subscribe to table updates after a disconnect.",
        category: "fix"
    },
    {
        id: "2025-03-15-tech-notes-tab",
        title: "Tech Notes Tab Added",
        date: "2025-03-15",
        description:
            "Added a dedicated Tech Notes tab to the main navigation so users and internal staff can quickly view recent software changes, fixes, and announcements.",
        category: "feature"
    },
    {
        id: "2025-03-10-tournament-chips",
        title: "Tournament Chip Display",
        date: "2025-03-10",
        description:
            "Fixed chip display for tournament games. Tournament stacks are now shown as integer chip counts rather than USDC micro-units.",
        category: "fix"
    },
    {
        id: "2025-03-05-global-header",
        title: "Global Header Redesign",
        date: "2025-03-05",
        description:
            "Refactored the global header to a 3-column desktop layout with logo+nav on the left and network status on the right. Admin access is now a discreet icon on the right side.",
        category: "improvement"
    },
    {
        id: "2025-02-20-animated-background",
        title: "Animated Background Component",
        date: "2025-02-20",
        description:
            "Introduced a reusable AnimatedBackground component with configurable card-suit particle animations used across multiple pages.",
        category: "feature"
    },
    {
        id: "2025-02-10-profile-avatars",
        title: "Profile Avatar Picker",
        date: "2025-02-10",
        description:
            "Users can now select a custom avatar from the header. Avatars are stored locally and displayed alongside seat labels at the poker table.",
        category: "feature"
    }
];
