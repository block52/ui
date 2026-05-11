import { useState, useEffect, useCallback } from "react";
import { AnimatedBackground } from "../../components/common/AnimatedBackground";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

const RELEASE_NOTES_URL =
    import.meta.env.VITE_APP_RELEASE_NOTE_URL ?? "https://raw.githubusercontent.com/block52/cards/refs/heads/main/release-notes/release-notes.json";

interface TechNote {
    id: string;
    date: string;
    title: string;
    version?: string;
    tags: string[];
    highlights?: string[];
    features?: string[];
    bugFixes?: string[];
    improvements?: string[];
    tests?: string[];
    body?: string;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function Section({ title, items, color }: { title: string; items: string[]; color: string }) {
    if (!items.length) return null;
    return (
        <div className="mt-4">
            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${color}`}>{title}</h3>
            <ul className="space-y-1">
                {items.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-300">
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${color.replace("text-", "bg-")}`} />
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function NoteCard({ note }: { note: TechNote }) {
    const [expanded, setExpanded] = useState(true);
    const isStructured = !!(note.highlights || note.features || note.bugFixes || note.improvements || note.tests);

    return (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6 hover:border-gray-500 transition-colors">
            <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                    {note.tags.map(tag => (
                        <span key={tag} className="text-xs font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
                            {tag}
                        </span>
                    ))}
                    {note.version && (
                        <span className="text-xs font-mono bg-gray-700 text-gray-300 border border-gray-600 px-2.5 py-0.5 rounded-full">{note.version}</span>
                    )}
                    <h2 className="text-white font-semibold text-lg">{note.title}</h2>
                </div>
                <span className="text-gray-400 text-sm whitespace-nowrap shrink-0">{formatDate(note.date)}</span>
            </div>

            {isStructured ? (
                <>
                    <Section title="Highlights" items={note.highlights ?? []} color="text-yellow-400" />
                    {expanded && (
                        <>
                            <Section title="Features" items={note.features ?? []} color="text-green-400" />
                            <Section title="Bug Fixes" items={note.bugFixes ?? []} color="text-red-400" />
                            <Section title="Improvements" items={note.improvements ?? []} color="text-blue-400" />
                            <Section title="Tests" items={note.tests ?? []} color="text-teal-400" />
                        </>
                    )}
                    <button onClick={() => setExpanded(v => !v)} className="mt-4 text-purple-400 hover:text-purple-300 text-sm transition-colors">
                        {expanded ? "Show less" : "Show features, fixes & improvements"}
                    </button>
                </>
            ) : note.body ? (
                <div className="mt-3">
                    <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">{note.body.trim()}</pre>
                </div>
            ) : null}
        </div>
    );
}

export default function TechNotesPage() {
    const [notes, setNotes] = useState<TechNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNotes = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(RELEASE_NOTES_URL);
            if (!response.ok) {
                throw new Error(`Failed to fetch release notes: ${response.status}`);
            }
            const data: TechNote[] = await response.json();
            setNotes(data);
        } catch (err) {
            console.error("Failed to fetch release notes:", err);
            setError(err instanceof Error ? err.message : "Failed to load release notes");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    return (
        <div className="min-h-screen relative">
            <AnimatedBackground />
            <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Tech Notes</h1>
                </div>

                {loading && (
                    <div className="flex justify-center py-20">
                        <LoadingSpinner />
                    </div>
                )}

                {error && (
                    <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 text-center">
                        <p className="text-red-300 mb-4">{error}</p>
                        <button onClick={fetchNotes} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                            Retry
                        </button>
                    </div>
                )}

                {!loading && !error && notes.length === 0 && <div className="text-center py-20 text-gray-500">No release notes found.</div>}

                {!loading && !error && notes.length > 0 && (
                    <div className="flex flex-col gap-4">
                        {notes.map(note => (
                            <NoteCard key={note.id} note={note} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
