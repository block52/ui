import { createContext, FC, ReactNode, useContext, useMemo } from "react";
import { CosmosApi } from "../apis/Api";
import { useNetwork } from "./NetworkContext";

const CosmosApiContext = createContext<CosmosApi>(null as any);

export const CosmosApiProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const { currentNetwork } = useNetwork();
    const api = useMemo(() => new CosmosApi({ baseUrl: currentNetwork.rest!, secure: true, timeout: 5000 }), [currentNetwork.rest]);
    return <CosmosApiContext.Provider value={api}>{children}</CosmosApiContext.Provider>;
};

export const useCosmosApi = (baseUrl?: string): CosmosApi => {
    const contextApi = useContext(CosmosApiContext);
    const customApi = useMemo(() => (baseUrl ? new CosmosApi({ baseUrl, secure: true, timeout: 5000 }) : null), [baseUrl]);
    return customApi ?? contextApi;
};
