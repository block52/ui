import React, { useMemo, useState } from "react";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { techNotes, TechNote, TechNoteCategory } from "../data/techNotes";

const CATEGORY_STYLES: Record<TechNoteCategory, { label: string; className: string }> = {
    feature: {
        label: "Feature",
        className: "bg-blue-900/50 text-blue-300 border border-blue-700/50"
    },
    fix: {
        label: "Fix",
        className: "bg-red-900/50 text-red-300 border border-red-700/50"
    },
    improvement: {
        label: "Improvement",
        className: "bg-purple-900/50 text-purple-300 border border-purple-700/50"
    },
    note: {
        label: "Note",
        className: "bg-yellow-900/50 text-yellow-300 border border-yellow-700/50"
    }
};

function formatDate(iso: string): string {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

interface TechNoteCardProps {
    note: TechNote;
}

const TechNoteCard: React.FC<TechNoteCardProps> = ({ note }) => {
    const cat = CATEGORY_STYLES[note.category];
    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 hover:border-gray-600 transition-colors duration-200">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                <h2 className="text-white font-semibold text-base leading-snug flex-1">{note.title}</h2>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cat.className}`}>
                        {cat.label}
                    </span>
                </div>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed mb-3">{note.description}</p>
            <p className="text-gray-500 text-xs">{formatDate(note.date)}</p>
        </div>
    );
};

const ALL_CATEGORY = "all";
type FilterCategory = TechNoteCategory | typeof ALL_CATEGORY;

export default function TechNotesPage() {
    const [filter, setFilter] = useState<FilterCategory>(ALL_CATEGORY);

    const filtered = useMemo<TechNote[]>(() => {
        const sorted = [...techNotes].sort((a, b) => b.date.localeCompare(a.date));
        if (filter === ALL_CATEGORY) return sorted;
        return sorted.filter(n => n.category === filter);
    }, [filter]);

    const filterButtons: { value: FilterCategory; label: string }[] = [
        { value: ALL_CATEGORY, label: "All" },
        { value: "feature", label: "Features" },
        { value: "fix", label: "Fixes" },
        { value: "improvement", label: "Improvements" },
        { value: "note", label: "Notes" }
    ];

    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />
            <div className="max-w-3xl mx-auto relative z-10">
                {/* Page Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-bold text-white mb-2">Tech Notes</h1>
                    <p className="text-gray-400 text-sm">Recent software updates, fixes, and announcements</p>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {filterButtons.map(btn => (
                        <button
                            key={btn.value}
                            onClick={() => setFilter(btn.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                                filter === btn.value
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            }`}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>

                {/* Notes List */}
                {filtered.length === 0 ? (
                    <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
                        <svg
                            className="w-12 h-12 text-gray-600 mx-auto mb-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.5"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                        </svg>
                        <p className="text-gray-400 text-sm">No updates in this category yet.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {filtered.map(note => (
                            <TechNoteCard key={note.id} note={note} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
