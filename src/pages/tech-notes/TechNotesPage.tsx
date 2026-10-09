import { useState, useCallback, useMemo } from "react";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { Card, PillButton } from "../../components/ui";
import { useReleaseNotes } from "../../hooks/useReleaseNotes";
import { isEmpty, hasElements, hasContent } from "../../utils/guards";
import {
    countChangesByKind,
    formatReleaseDate,
    formatReleaseDateShort,
    groupReleasesByMonth,
    isStructuredRelease,
    parseChangeRefs,
    releaseChanges,
    type ChangeKind,
    type ReleaseNote
} from "../../utils/releaseNotes";

const EARLIER_PAGE_SIZE = 5;

type KindFilter = "all" | ChangeKind;

const KIND_STYLE: Record<ChangeKind, { label: string; chip: string; text: string; dot: string }> = {
    feature: { label: "Feature", chip: "Features", text: "text-emerald-400", dot: "bg-emerald-400" },
    bugFix: { label: "Bug fix", chip: "Bug fixes", text: "text-red-400", dot: "bg-red-400" },
    improvement: { label: "Improvement", chip: "Improvements", text: "text-sky-700 dark:text-sky-400", dot: "bg-sky-400" },
    test: { label: "Test", chip: "Tests", text: "text-teal-700 dark:text-teal-400", dot: "bg-teal-400" }
};

const ChevronRight = () => (
    <svg className="w-4 h-4 shrink-0 text-ink-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 5l5 5-5 5" />
    </svg>
);

const KindChip = ({ label, count, dot, selected, onClick }: { label: string; count: number; dot: string; selected: boolean; onClick: () => void }) => {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={`flex items-center gap-1.5 h-11 sm:h-9 px-3.5 rounded-btn border text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-light ${
                selected ? "border-brand bg-brand/15 text-ink" : "border-line-strong text-ink-soft hover:text-ink hover:bg-surface-hover"
            }`}
        >
            <span className={`w-[7px] h-[7px] rounded-full ${dot}`} aria-hidden="true" />
            {label}
            <span className="text-ink-muted tabular-nums">{count}</span>
        </button>
    );
};

const ChangeRow = ({ kind, line }: { kind: ChangeKind; line: string }) => {
    const { text, refs } = parseChangeRefs(line);
    const style = KIND_STYLE[kind];
    return (
        <li className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3.5 py-2.5 border-t border-line">
            <span className={`shrink-0 sm:w-24 text-xs font-semibold ${style.text}`}>{style.label}</span>
            <span className="flex-1 min-w-0 text-ink-body leading-relaxed break-words">{text}</span>
            {hasElements(refs) && (
                <span className="shrink-0 flex flex-wrap gap-x-2 font-mono text-xs">
                    {refs.map((ref, i) =>
                        ref.url ? (
                            <a key={`${ref.label}-${i}`} href={ref.url} target="_blank" rel="noopener noreferrer" className="text-brand dark:text-brand-light hover:text-ink hover:underline">
                                {ref.label}
                            </a>
                        ) : (
                            <span key={`${ref.label}-${i}`} className="text-ink-muted">
                                {ref.label}
                            </span>
                        )
                    )}
                </span>
            )}
        </li>
    );
};

const ReleaseArticle = ({ note, isLatest }: { note: ReleaseNote; isLatest: boolean }) => {
    const [filter, setFilter] = useState<KindFilter>("all");
    const changes = useMemo(() => releaseChanges(note), [note]);
    const counts = useMemo(() => countChangesByKind(changes), [changes]);
    const visible = filter === "all" ? changes : changes.filter(change => change.kind === filter);
    const structured = isStructuredRelease(note);
    const highlights = note.highlights ?? [];
    const chipKinds: ChangeKind[] = counts.test > 0 ? ["feature", "bugFix", "improvement", "test"] : ["feature", "bugFix", "improvement"];

    return (
        <Card as="article" className="p-5 sm:p-7 flex flex-col gap-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap gap-2">
                    {isLatest && <span className="px-2.5 py-0.5 rounded-full bg-brand text-white text-xs font-semibold">Latest</span>}
                    {note.version && <span className="px-2.5 py-0.5 rounded-full border border-line-strong text-ink-soft text-xs font-mono">{note.version}</span>}
                    {note.tags.map(tag => (
                        <span key={tag} className="px-2.5 py-0.5 rounded-full border border-line-strong text-ink-soft text-xs font-mono break-all">
                            {tag}
                        </span>
                    ))}
                </div>
                <span className="text-ink-muted text-sm">{formatReleaseDate(note.date)}</span>
            </div>

            <h2 className="m-0 text-[22px] font-semibold text-ink leading-snug [text-wrap:balance]">{note.title}</h2>

            {hasElements(highlights) && (
                <div className="flex flex-col gap-2 px-[18px] py-4 rounded-xl bg-brand/10">
                    <span className="text-brand dark:text-brand-light text-xs font-semibold uppercase tracking-[0.08em]">Highlights</span>
                    <ul className="m-0 pl-[18px] list-disc text-ink-body leading-relaxed">
                        {highlights.map((item, i) => (
                            <li key={i}>{item}</li>
                        ))}
                    </ul>
                </div>
            )}

            {structured && hasElements(changes) && (
                <>
                    <div role="group" aria-label="Change type" className="flex flex-wrap gap-2">
                        <KindChip label="All changes" count={changes.length} dot="bg-ink-soft" selected={filter === "all"} onClick={() => setFilter("all")} />
                        {chipKinds.map(kind => (
                            <KindChip
                                key={kind}
                                label={KIND_STYLE[kind].chip}
                                count={counts[kind]}
                                dot={KIND_STYLE[kind].dot}
                                selected={filter === kind}
                                onClick={() => setFilter(kind)}
                            />
                        ))}
                    </div>
                    <ul className="m-0 p-0 list-none flex flex-col">
                        {visible.map((change, i) => (
                            <ChangeRow key={`${change.kind}-${i}`} kind={change.kind} line={change.text} />
                        ))}
                        {isEmpty(visible) && <li className="py-3 border-t border-line text-ink-muted text-sm">No changes of this kind in this release.</li>}
                    </ul>
                </>
            )}

            {!structured && hasContent(note.body) && (
                <pre className="m-0 text-ink-body text-sm whitespace-pre-wrap font-sans leading-relaxed">{note.body.trim()}</pre>
            )}
        </Card>
    );
};

export default function TechNotesPage() {
    const { notes, loading, error, refetch } = useReleaseNotes();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [earlierShown, setEarlierShown] = useState(EARLIER_PAGE_SIZE);

    const latest = notes[0];
    const selected = notes.find(note => note.id === selectedId) ?? latest;
    const months = useMemo(() => groupReleasesByMonth(notes), [notes]);
    const earlier = useMemo(() => notes.filter(note => note.id !== selected?.id), [notes, selected]);

    const selectRelease = useCallback((id: string) => {
        setSelectedId(id);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    return (
        <div className="min-h-screen bg-surface-page text-ink-body text-sm">
            <main className="max-w-[1376px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                    <h1 className="m-0 text-[28px] font-semibold text-ink">Tech Notes</h1>
                    <span className="text-ink-muted">Weekly release notes for Poker VM, Pokerchain and the app</span>
                </div>

                {loading && (
                    <div className="flex justify-center py-20">
                        <LoadingSpinner />
                    </div>
                )}

                {error && (
                    <Card className="p-6 flex flex-col items-center gap-4 text-center">
                        <p className="m-0 text-red-400">{error}</p>
                        <PillButton variant="outline" size="sm" onClick={refetch}>
                            Retry
                        </PillButton>
                    </Card>
                )}

                {!loading && !error && isEmpty(notes) && <div className="text-center py-20 text-ink-muted">No release notes found.</div>}

                {!loading && !error && selected && (
                    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
                        <aside aria-label="Release archive" className="hidden lg:flex flex-col gap-[18px] w-[260px] shrink-0 sticky top-6">
                            {months.map(month => (
                                <div key={month.label} className="flex flex-col gap-0.5">
                                    <span className="px-2.5 pb-1.5 text-ink-muted text-xs uppercase tracking-[0.08em]">{month.label}</span>
                                    {month.items.map(({ note, day }) => {
                                        const current = note.id === selected.id;
                                        return (
                                            <button
                                                key={note.id}
                                                type="button"
                                                aria-current={current ? "true" : undefined}
                                                onClick={() => selectRelease(note.id)}
                                                title={note.title}
                                                className={`flex gap-3 px-2.5 py-2 rounded-lg text-left transition-colors ${
                                                    current ? "bg-brand/15 text-ink" : "text-ink-soft hover:bg-surface-raised hover:text-ink"
                                                }`}
                                            >
                                                <span className="shrink-0 w-[22px] text-ink-muted tabular-nums">{day}</span>
                                                <span className="min-w-0 truncate">{note.title}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </aside>

                        <div className="flex-1 min-w-0 w-full flex flex-col gap-4">
                            <label className="lg:hidden flex flex-col gap-1.5">
                                <span className="text-ink-muted text-xs uppercase tracking-[0.08em]">Release</span>
                                <select
                                    value={selected.id}
                                    onChange={e => selectRelease(e.target.value)}
                                    className="h-11 w-full px-3 rounded-xl bg-surface-raised border border-line text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                                >
                                    {notes.map(note => (
                                        <option key={note.id} value={note.id}>
                                            {formatReleaseDateShort(note.date)} · {note.title}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <ReleaseArticle key={selected.id} note={selected} isLatest={selected.id === latest.id} />

                            {hasElements(earlier) && (
                                <Card>
                                    <h2 className="m-0 px-5 sm:px-6 py-4 text-[15px] font-semibold text-ink-muted">
                                        {selected.id === latest.id ? "Earlier releases" : "Other releases"}
                                    </h2>
                                    {earlier.slice(0, earlierShown).map(note => (
                                        <button
                                            key={note.id}
                                            type="button"
                                            onClick={() => selectRelease(note.id)}
                                            className="w-full flex items-center gap-3 sm:gap-4 px-5 sm:px-6 py-4 border-t border-line text-left hover:bg-surface-raised transition-colors"
                                        >
                                            <span className="shrink-0 w-24 sm:w-[110px] text-ink-muted tabular-nums">{formatReleaseDateShort(note.date)}</span>
                                            <span className="flex-1 min-w-0 text-ink font-medium leading-snug">{note.title}</span>
                                            <ChevronRight />
                                        </button>
                                    ))}
                                    {earlier.length > earlierShown && (
                                        <button
                                            type="button"
                                            onClick={() => setEarlierShown(shown => shown + EARLIER_PAGE_SIZE)}
                                            className="w-full h-[52px] border-t border-line text-brand dark:text-brand-light font-medium hover:bg-surface-raised transition-colors"
                                        >
                                            Show older releases
                                        </button>
                                    )}
                                </Card>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
