import { useState, useEffect, useCallback } from "react";
import { AnimatedBackground } from "../../components/common/AnimatedBackground";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";

const UI_GITHUB_RELEASES_URL = "https://api.github.com/repos/block52/ui/releases";
const PVM_GITHUB_RELEASES_URL = "https://api.github.com/repos/block52/poker-vm/releases";
const CHAIN_GITHUB_RELEASES_URL = "https://api.github.com/repos/block52/pokerchain/releases";
const pvmToken = import.meta.env.VITE_PVM_GITHUB_TOKEN;
const chainToken = import.meta.env.VITE_POKERCHAIN_GITHUB_TOKEN;

interface GitHubRelease {
    id: number;
    tag_name: string;
    name: string;
    body: string;
    published_at: string;
    html_url: string;
    prerelease: boolean;
    draft: boolean;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function ReleaseCard({ release }: { release: GitHubRelease }) {
    const [expanded, setExpanded] = useState(false);
    const body = release.body?.trim() || "";
    const lines = body.split("\n");
    const preview = lines.slice(0, 6).join("\n");
    const hasMore = lines.length > 6;

    return (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-6 hover:border-gray-500 transition-colors">
            <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
                        {release.tag_name}
                    </span>
                    {release.prerelease && (
                        <span className="text-xs font-mono bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-2.5 py-0.5 rounded-full">
                            pre-release
                        </span>
                    )}
                    <h2 className="text-white font-semibold text-lg">{release.name || release.tag_name}</h2>
                </div>
                <span className="text-gray-400 text-sm whitespace-nowrap shrink-0">{formatDate(release.published_at)}</span>
            </div>

            {body ? (
                <div className="mt-3">
                    <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">{expanded || !hasMore ? body : preview}</pre>
                    {hasMore && (
                        <button onClick={() => setExpanded(v => !v)} className="mt-2 text-blue-400 hover:text-blue-300 text-sm transition-colors">
                            {expanded ? "Show less" : "Show more"}
                        </button>
                    )}
                </div>
            ) : (
                <p className="text-gray-500 text-sm italic mt-3">No release notes provided.</p>
            )}

            <a
                href={release.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-xs text-gray-400 hover:text-white transition-colors"
            >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                View on GitHub
            </a>
        </div>
    );
}

export default function TechNotesPage() {
    const [releases, setReleases] = useState<GitHubRelease[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchReleases = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // use access token if available to increase rate limit

            const chainResponse = await fetch(CHAIN_GITHUB_RELEASES_URL + "?per_page=30", {
                method: "GET",
                headers: chainToken ? { Authorization: `Bearer ${chainToken}`, Accept: "application/vnd.github.v3+json" } : undefined,
                cache: "no-store"
            });
            if (!chainResponse.ok) {
                throw new Error(`GitHub API returned ${chainResponse.status} for chain releases`);
            }

            const chainData: GitHubRelease[] = await chainResponse.json();
            
            const pvmResponse = await fetch(PVM_GITHUB_RELEASES_URL + "?per_page=30", {
                method: "GET",
                headers: pvmToken ? { Authorization: `Bearer ${pvmToken}`, Accept: "application/vnd.github.v3+json" } : undefined,
                cache: "no-store"
            });
            if (!pvmResponse.ok) {
                throw new Error(`GitHub API returned ${pvmResponse.status} for PVM releases`);
            }
            const pvmData: GitHubRelease[] = await pvmResponse.json();


            const response = await fetch(`${UI_GITHUB_RELEASES_URL}?per_page=30`);
            if (!response.ok) {
                throw new Error(`GitHub API returned ${response.status}`);
            }
            const data: GitHubRelease[] = await response.json();
            setReleases(data.filter(r => !r.draft));
        } catch (err) {
            console.error("Failed to fetch releases:", err);
            setError(err instanceof Error ? err.message : "Failed to load release notes");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReleases();
    }, [fetchReleases]);

    return (
        <div className="min-h-screen relative">
            <AnimatedBackground />
            <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Tech Notes</h1>
                    <p className="text-gray-400">
                        Release notes from the{" "}
                        <a
                            href="https://github.com/block52/ui"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            block52/ui
                        </a>{" "}
                        repository.
                    </p>
                </div>

                {loading && (
                    <div className="flex justify-center py-20">
                        <LoadingSpinner />
                    </div>
                )}

                {error && (
                    <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 text-center">
                        <p className="text-red-300 mb-4">{error}</p>
                        <button onClick={fetchReleases} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                            Retry
                        </button>
                    </div>
                )}

                {!loading && !error && releases.length === 0 && <div className="text-center py-20 text-gray-500">No releases found.</div>}

                {!loading && !error && releases.length > 0 && (
                    <div className="flex flex-col gap-4">
                        {releases.map(release => (
                            <ReleaseCard key={release.id} release={release} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
