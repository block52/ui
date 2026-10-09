import { useCallback, useEffect, useState } from "react";
import { useReleaseNotesApi } from "../context/ReleaseNotesApiContext";
import { parseReleaseNotes, type ReleaseNote } from "../utils/releaseNotes";

export const useReleaseNotes = () => {
    const api = useReleaseNotesApi();
    const [notes, setNotes] = useState<ReleaseNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNotes = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const parsed = parseReleaseNotes(await api.getReleaseNotes());
            parsed.skipped.forEach(reason => console.error("Skipped malformed release note,", reason));
            setNotes(parsed.notes);
        } catch (err) {
            console.error("Failed to fetch release notes:", err);
            setError(err instanceof Error ? err.message : "Failed to load release notes");
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    return { notes, loading, error, refetch: fetchNotes };
};
