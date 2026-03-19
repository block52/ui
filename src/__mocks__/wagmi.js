// Mock for wagmi - ESM package that Jest can't parse
module.exports = {
    useWriteContract: jest.fn(() => ({
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        data: undefined,
        error: null,
        isPending: false,
        isSuccess: false,
        isError: false,
        reset: jest.fn()
    })),
    useWaitForTransactionReceipt: jest.fn(() => ({
        data: undefined,
        isLoading: false,
        isSuccess: false,
        isError: false,
        error: null
    })),
    useConnection: jest.fn(() => ({
        address: undefined,
        isConnected: false,
        isConnecting: false,
        isDisconnected: true,
        status: "disconnected"
    })),
    useConnect: jest.fn(() => ({
        connect: jest.fn(),
        connectors: [],
        isPending: false,
        error: null
    })),
    useDisconnect: jest.fn(() => ({
        disconnect: jest.fn()
    })),
    useBalance: jest.fn(() => ({
        data: undefined,
        isLoading: false,
        isError: false
    })),
    useChainId: jest.fn(() => 1),
    useSwitchChain: jest.fn(() => ({
        switchChain: jest.fn(),
        isPending: false
    })),
    WagmiProvider: ({ children }) => children,
    createConfig: jest.fn(),
    http: jest.fn()
};
