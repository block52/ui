import { createContext, FC, ReactNode, useContext, useMemo } from "react";
import { CometRpcApi, CosmosApi } from "../apis/Api";
import { useNetwork } from "./NetworkContext";

const CosmosApiContext = createContext<CosmosApi | null>(null);

export const CosmosApiProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const { currentNetwork } = useNetwork();
    const api = useMemo(() => new CosmosApi({ baseUrl: currentNetwork.rest!, secure: true, timeout: 5000 }), [currentNetwork.rest]);
    return <CosmosApiContext.Provider value={api}>{children}</CosmosApiContext.Provider>;
};

export const useCosmosApi = (baseUrl?: string): CosmosApi => {
    const contextApi = useContext(CosmosApiContext);
    const customApi = useMemo(() => (baseUrl ? new CosmosApi({ baseUrl, secure: true, timeout: 5000 }) : null), [baseUrl]);
    const api = customApi ?? contextApi;
    if (!api) {
        throw new Error("useCosmosApi must be used within a CosmosApiProvider (or called with a baseUrl)");
    }
    return api;
};

/**
 * Returns a factory for building a CosmosApi bound to an arbitrary node REST URL.
 * Used by node-discovery pages that probe many different node endpoints, where a
 * single context-bound instance (tied to the current network) does not fit.
 * Construction stays in the context layer so components never `new` an API class directly.
 */
export const useCosmosApiFactory = (): ((baseUrl: string) => CosmosApi) => {
    return useMemo(() => (baseUrl: string) => new CosmosApi({ baseUrl, secure: true, timeout: 10000 }), []);
};

/**
 * Returns a factory for a CometRpcApi bound to a node's RPC URL. History lookups
 * (hand replay) may need a different node from the current network, because not
 * every node keeps historical state.
 */
export const useCometRpcApiFactory = (): ((rpcUrl: string) => CometRpcApi) => {
    return useMemo(() => (rpcUrl: string) => new CometRpcApi({ baseUrl: rpcUrl, secure: false, timeout: 15000 }), []);
};
