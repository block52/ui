import React, { useContext, useMemo } from "react";
import { IndexerApi } from "../apis/Api";

const IndexerApiContext = React.createContext<IndexerApi | null>(null);

export const IndexerApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const api = useMemo(() => new IndexerApi({ baseUrl: import.meta.env.VITE_INDEXER_URL || "https://indexer.block52.xyz", secure: true }), []);
    return <IndexerApiContext.Provider value={api}>{children}</IndexerApiContext.Provider>;
};

export const useIndexerApi = (): IndexerApi => {
    const context = useContext(IndexerApiContext);
    if (!context) {
        throw new Error("useIndexerApi must be used within an IndexerApiProvider");
    }
    return context;
};
