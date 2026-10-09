import { createContext, FC, ReactNode, useContext, useMemo } from "react";
import { ReleaseNotesApi } from "../apis/Api";
import { viteEnv } from "../utils/viteEnv";
import { hasContent } from "../utils/guards";

const DEFAULT_RELEASE_NOTES_URL = "https://raw.githubusercontent.com/block52/cards/refs/heads/main/release-notes/release-notes.json";

const ReleaseNotesApiContext = createContext<ReleaseNotesApi | null>(null);

export const ReleaseNotesApiProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const api = useMemo(() => {
        const configured = viteEnv.VITE_APP_RELEASE_NOTE_URL;
        return new ReleaseNotesApi({ baseUrl: hasContent(configured) ? configured : DEFAULT_RELEASE_NOTES_URL, secure: false, timeout: 10000 });
    }, []);

    return <ReleaseNotesApiContext.Provider value={api}>{children}</ReleaseNotesApiContext.Provider>;
};

export const useReleaseNotesApi = (): ReleaseNotesApi => {
    const context = useContext(ReleaseNotesApiContext);
    if (!context) {
        throw new Error("useReleaseNotesApi must be used within a ReleaseNotesApiProvider");
    }
    return context;
};
