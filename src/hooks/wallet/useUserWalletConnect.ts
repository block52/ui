import { useConnect, useConnection, useConnectors, useDisconnect } from "wagmi";
import { useCallback, useMemo } from "react";
import { injected } from "wagmi/connectors";

interface UseUserWalletConnectResult {
    open: () => void;
    disconnect: () => void;
    isConnected: boolean | null;
    address: string | undefined;
}

const useUserWalletConnect = (): UseUserWalletConnectResult => {
    const { mutateAsync: connect } = useConnect();
    const connectors = useConnectors();
    const { mutateAsync } = useDisconnect();
    const { address, isConnected } = useConnection();

    const open = useCallback(() => {
        if (connectors.length > 0) {
            connect({ connector: injected() }); // connectors[1] is injected connector, which is usually MetaMask. Adjust the index if you want to use a different connector.
        }
    }, [connect, connectors]);

    const disconnect = useCallback(() => {
        mutateAsync(); // Disconnect using the same connector used for connection
    }, [mutateAsync]);

    return useMemo(
        () => ({
            open,
            disconnect,
            isConnected,
            address
        }),
        [open, isConnected, disconnect, address]
    );
};

export { useUserWalletConnect };
export default useUserWalletConnect;
