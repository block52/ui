import React, { useContext, useMemo } from "react";
import { BrokerApi } from "../apis/Api";

const BrokerApiContext = React.createContext<BrokerApi | null>(null);

export const BrokerApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const api = useMemo(
        () => new BrokerApi({ baseUrl: import.meta.env.VITE_TG_BROKER_URL || "http://localhost:8089", secure: false }),
        []
    );
    return <BrokerApiContext.Provider value={api}>{children}</BrokerApiContext.Provider>;
};

export const useBrokerApi = (): BrokerApi => {
    const context = useContext(BrokerApiContext);
    if (!context) {
        throw new Error("useBrokerApi must be used within a BrokerApiProvider");
    }
    return context;
};
