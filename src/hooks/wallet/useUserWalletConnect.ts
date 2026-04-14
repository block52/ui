import { useEffect, useMemo, useState } from "react";
import { useAppKit, useAppKitAccount, useDisconnect } from "@reown/appkit/react";

interface UseUserWalletConnectResult {
    open: () => void;
    disconnect: () => void;
    isConnected: boolean | null;
    address: string | undefined;
}

const useUserWalletConnect = (): UseUserWalletConnectResult => {
    const { open } = useAppKit();
    const { disconnect } = useDisconnect();
    const { address, isConnected } = useAppKitAccount();
    const [connected, setConnected] = useState<boolean | null>(null);

    useEffect(() => {
        setConnected(isConnected);
    }, [isConnected]);

    return useMemo(
        () => ({
            open,
            disconnect,
            isConnected: connected,
            address
        }),
        [open, connected, disconnect, address]
    );
};

export { useUserWalletConnect };
export default useUserWalletConnect;
