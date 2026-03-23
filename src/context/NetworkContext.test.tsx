import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { NetworkProvider, useNetwork, NETWORK_PRESETS, NetworkEndpoints } from "./NetworkContext";

// Helper component to access context in tests
const TestConsumer: React.FC<{ onMount?: (ctx: ReturnType<typeof useNetwork>) => void }> = ({ onMount }) => {
    const context = useNetwork();
    React.useEffect(() => {
        onMount?.(context);
    }, [context, onMount]);
    return (
        <div>
            <span data-testid="network-name">{context.currentNetwork.name}</span>
            <span data-testid="network-ws">{context.currentNetwork.ws}</span>
            <span data-testid="network-count">{context.availableNetworks.length}</span>
        </div>
    );
};

// Component to test network switching
const NetworkSwitcher: React.FC = () => {
    const { currentNetwork, setNetwork, availableNetworks } = useNetwork();
    return (
        <div>
            <span data-testid="current-network">{currentNetwork.name}</span>
            {availableNetworks.map((network, index) => (
                <button key={index} data-testid={`switch-${network.name}`} onClick={() => setNetwork(network)}>
                    Switch to {network.name}
                </button>
            ))}
        </div>
    );
};

describe("NetworkContext", () => {
    // Clear localStorage before each test
    beforeEach(() => {
        localStorage.clear();
    });

    describe("NETWORK_PRESETS", () => {
        it("should have four network presets", () => {
            expect(NETWORK_PRESETS).toHaveLength(4);
        });

        it("should have Block52 as first preset", () => {
            expect(NETWORK_PRESETS[0].name).toBe("Block52");
            expect(NETWORK_PRESETS[0].ws).toBe("wss://node1.block52.xyz/ws");
        });

        it("should have Localhost as second preset", () => {
            expect(NETWORK_PRESETS[1].name).toBe("Localhost");
            expect(NETWORK_PRESETS[1].ws).toBe("ws://localhost:8585/ws");
        });

        it("should have Texas Hodl as third preset", () => {
            expect(NETWORK_PRESETS[2].name).toBe("Texas Hodl");
            expect(NETWORK_PRESETS[2].ws).toBe("wss://node.texashodl.net/ws");
        });

        it("should have Miller Services as fourth preset", () => {
            expect(NETWORK_PRESETS[3].name).toBe("Miller Services");
            expect(NETWORK_PRESETS[3].ws).toBe("wss://node.tommillerservices.com/ws");
        });

        it("should have all required endpoints for each preset", () => {
            NETWORK_PRESETS.forEach(network => {
                expect(network.name).toBeDefined();
                expect(network.rpc).toBeDefined();
                expect(network.rest).toBeDefined();
                expect(network.grpc).toBeDefined();
                expect(network.ws).toBeDefined();
            });
        });
    });

    describe("NetworkProvider", () => {
        it("should provide network context to children", () => {
            render(
                <NetworkProvider>
                    <TestConsumer />
                </NetworkProvider>
            );

            expect(screen.getByTestId("network-name")).toBeInTheDocument();
            expect(screen.getByTestId("network-ws")).toBeInTheDocument();
        });

        it("should default to Block52 when no saved preference", () => {
            render(
                <NetworkProvider>
                    <TestConsumer />
                </NetworkProvider>
            );

            expect(screen.getByTestId("network-name").textContent).toBe("Block52");
        });

        it("should provide all available networks", () => {
            render(
                <NetworkProvider>
                    <TestConsumer />
                </NetworkProvider>
            );

            expect(screen.getByTestId("network-count").textContent).toBe("4");
        });

        it("should load saved network from localStorage", () => {
            const savedNetwork: NetworkEndpoints = {
                name: "Block52",
                rpc: "https://node1.block52.xyz/rpc/",
                rest: "https://node1.block52.xyz",
                grpc: "grpcs://node1.block52.xyz:9443",
                ws: "wss://node1.block52.xyz/ws"
            };
            localStorage.setItem("selectedNetwork", JSON.stringify(savedNetwork));

            render(
                <NetworkProvider>
                    <TestConsumer />
                </NetworkProvider>
            );

            expect(screen.getByTestId("network-name").textContent).toBe("Block52");
        });

        it("should reset to default if saved network is missing ws property", () => {
            // Simulate old localStorage format without ws
            const oldFormatNetwork = {
                name: "OldNetwork",
                rpc: "http://old.network",
                rest: "http://old.network",
                grpc: "http://old.network"
                // Missing ws property
            };
            localStorage.setItem("selectedNetwork", JSON.stringify(oldFormatNetwork));

            render(
                <NetworkProvider>
                    <TestConsumer />
                </NetworkProvider>
            );

            // Should fall back to Block52
            expect(screen.getByTestId("network-name").textContent).toBe("Block52");
        });

        it("should reset to default if localStorage is corrupted", () => {
            localStorage.setItem("selectedNetwork", "not-valid-json{{{");

            render(
                <NetworkProvider>
                    <TestConsumer />
                </NetworkProvider>
            );

            // Should fall back to Block52
            expect(screen.getByTestId("network-name").textContent).toBe("Block52");
        });
    });

    describe("setNetwork", () => {
        it("should allow switching networks", () => {
            render(
                <NetworkProvider>
                    <NetworkSwitcher />
                </NetworkProvider>
            );

            // Initially Block52
            expect(screen.getByTestId("current-network").textContent).toBe("Block52");

            // Switch to Localhost
            fireEvent.click(screen.getByTestId("switch-Localhost"));
            expect(screen.getByTestId("current-network").textContent).toBe("Localhost");

            // Switch to Block52
            fireEvent.click(screen.getByTestId("switch-Block52"));
            expect(screen.getByTestId("current-network").textContent).toBe("Block52");
        });

        it("should persist network selection to localStorage", () => {
            render(
                <NetworkProvider>
                    <NetworkSwitcher />
                </NetworkProvider>
            );

            fireEvent.click(screen.getByTestId("switch-Localhost"));

            const saved = localStorage.getItem("selectedNetwork");
            expect(saved).toBeDefined();

            const parsed = JSON.parse(saved!);
            expect(parsed.name).toBe("Localhost");
            expect(parsed.ws).toBe("ws://localhost:8585/ws");
        });
    });

    describe("useNetwork hook", () => {
        it("should throw error when used outside provider", () => {
            // Suppress console.error for this test
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            expect(() => {
                render(<TestConsumer />);
            }).toThrow("useNetwork must be used within a NetworkProvider");

            consoleSpy.mockRestore();
        });

        it("should return context with all required properties", () => {
            let capturedContext: ReturnType<typeof useNetwork> | null = null;

            render(
                <NetworkProvider>
                    <TestConsumer
                        onMount={ctx => {
                            capturedContext = ctx;
                        }}
                    />
                </NetworkProvider>
            );

            expect(capturedContext).not.toBeNull();
            expect(capturedContext!.currentNetwork).toBeDefined();
            expect(capturedContext!.setNetwork).toBeDefined();
            expect(capturedContext!.availableNetworks).toBeDefined();
            expect(typeof capturedContext!.setNetwork).toBe("function");
        });
    });
});
