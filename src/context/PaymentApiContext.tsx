import { createContext, FC, ReactNode, useContext } from "react";
import { PaymentApi } from "../apis/Api";
import { PROXY_URL } from "../config/constants";

const PaymentApiContext = createContext<PaymentApi>(null as any);

export const PaymentApiProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const api = new PaymentApi({ baseUrl: PROXY_URL!, secure: true, timeout: 5000 });

    return <PaymentApiContext.Provider value={api}>{children}</PaymentApiContext.Provider>;
};

export const usePaymentApi = (): PaymentApi => {
    return useContext(PaymentApiContext);
};
