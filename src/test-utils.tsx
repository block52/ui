/**
 * Test utilities for the Block52 Poker UI
 *
 * This file provides:
 * - Custom render function with all providers
 * - Mock implementations for common dependencies
 * - Test fixtures and helpers
 */

import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { GameFormat } from "@block52/poker-vm-sdk";

// Mock network endpoints for testing
export const mockNetworkEndpoints = {
    name: "Test Network",
    rpc: "http://localhost:26657",
    rest: "http://localhost:1317",
    grpc: "localhost:9090",
    ws: "ws://localhost:8585/ws"
};

// Mock network context value - matches NetworkContextType interface
export const mockNetworkContext = {
    currentNetwork: mockNetworkEndpoints,
    availableNetworks: [mockNetworkEndpoints],
    setNetwork: jest.fn()
};

// Mock game state context value
export const mockGameStateContext = {
    gameState: undefined,
    isLoading: false,
    error: null,
    pendingAction: null,
    subscribeToTable: jest.fn(),
    unsubscribeFromTable: jest.fn(),
    sendAction: jest.fn().mockResolvedValue(undefined)
};

// Simple provider wrapper for tests
interface ProvidersProps {
    children: React.ReactNode;
}

const TestProviders: React.FC<ProvidersProps> = ({ children }) => {
    return <BrowserRouter>{children}</BrowserRouter>;
};

/**
 * Custom render function that wraps components with necessary providers
 */
const customRender = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
    render(ui, { wrapper: TestProviders, ...options });

// Re-export everything from testing-library
export * from "@testing-library/react";

// Override render with our custom version
export { customRender as render };

// ============================================================================
// Mock Factories
// ============================================================================

// Standard bech32 test addresses for Block52 (b521 HRP)
export const TEST_ADDRESSES = {
    PLAYER_1: "b521qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5z5tpwxqer",
    PLAYER_2: "b521qz4sdj8gfx9w9r8h8xvnkkl0xhucqhqv39gtr7",
    PLAYER_3: "b521q8h9jkl3mn4op5qr6st7uv8wx9yz0abc1def2gh",
    GAME: "b521qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5lmn4op"
};

/**
 * Create a mock player for testing
 * Uses Cosmos bech32 address format (b52 prefix)
 */
export const createMockPlayer = (overrides = {}) => ({
    address: TEST_ADDRESSES.PLAYER_1,
    seat: 1,
    stack: "1000000000", // 1000 USDC in micro units
    status: "active",
    holeCards: [],
    ...overrides
});

/**
 * Create a mock game state for testing
 * Uses Cosmos bech32 address format for game address
 */
export const createMockGameState = (overrides = {}) => ({
    gameFormat: GameFormat.CASH,
    address: TEST_ADDRESSES.GAME,
    players: [],
    communityCards: [],
    pots: ["0"],
    currentRound: "preflop",
    dealerSeat: 0,
    currentPlayerSeat: 1,
    smallBlind: "10000000", // 10 USDC
    bigBlind: "20000000", // 20 USDC
    ...overrides
});

/**
 * Create a mock action for testing
 * Uses Cosmos bech32 address format for playerId
 */
export const createMockAction = (overrides = {}) => ({
    playerId: TEST_ADDRESSES.PLAYER_1,
    action: "call",
    amount: "20000000",
    index: 0,
    ...overrides
});

// ============================================================================
// WebSocket Mock
// ============================================================================

/**
 * Mock WebSocket class for testing
 */
export class MockWebSocket {
    url: string;
    readyState: number = 0; // CONNECTING
    onopen: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    static instances: MockWebSocket[] = [];

    constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
        // Simulate connection after a tick
        setTimeout(() => {
            this.readyState = 1; // OPEN
            this.onopen?.(new Event("open"));
        }, 0);
    }

    send(data: string): void {
        // Mock implementation - can be spied on
    }

    close(): void {
        this.readyState = 3; // CLOSED
        this.onclose?.(new CloseEvent("close"));
    }

    // Helper to simulate receiving a message
    simulateMessage(data: unknown): void {
        const event = new MessageEvent("message", {
            data: JSON.stringify(data)
        });
        this.onmessage?.(event);
    }

    // Helper to simulate an error
    simulateError(): void {
        this.onerror?.(new Event("error"));
    }

    static clearInstances(): void {
        MockWebSocket.instances = [];
    }

    static getLastInstance(): MockWebSocket | undefined {
        return MockWebSocket.instances[MockWebSocket.instances.length - 1];
    }
}

// ============================================================================
// Fetch Mock Helpers
// ============================================================================

/**
 * Create a mock fetch response
 */
export const createMockFetchResponse = (data: unknown, ok = true, status = 200) => {
    return Promise.resolve({
        ok,
        status,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data))
    });
};

/**
 * Setup fetch mock with predefined responses
 */
export const setupFetchMock = (responses: Record<string, unknown>) => {
    global.fetch = jest.fn((url: string) => {
        const matchedUrl = Object.keys(responses).find(pattern => url.includes(pattern));
        if (matchedUrl) {
            return createMockFetchResponse(responses[matchedUrl]);
        }
        return createMockFetchResponse({ error: "Not found" }, false, 404);
    }) as jest.Mock;
};

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Wait for a condition to be true
 */
export const waitForCondition = async (condition: () => boolean, timeout = 5000): Promise<void> => {
    const start = Date.now();
    while (!condition()) {
        if (Date.now() - start > timeout) {
            throw new Error("Timeout waiting for condition");
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
};
