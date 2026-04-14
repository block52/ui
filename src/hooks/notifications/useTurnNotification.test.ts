import { renderHook } from "@testing-library/react";
import { useTurnNotification, createFaviconNotification } from "./useTurnNotification";

// Mock colorConfig to avoid import.meta issues
jest.mock("../../utils/colorConfig", () => ({
    colors: {
        brand: {
            primary: "#3b82f6",
            secondary: "#1a2639"
        },
        table: {
            bgGradientStart: "#1a2639",
            bgGradientMid: "#2a3f5f",
            bgGradientEnd: "#1a2639",
            bgBase: "#111827",
            borderColor: "#3a546d"
        },
        animation: {
            color1: "#3d59a1",
            color2: "#2a488f",
            color3: "#4263af",
            color4: "#1e346b",
            color5: "#324f97"
        },
        accent: {
            glow: "#64ffda",
            success: "#10b981",
            danger: "#ef4444",
            warning: "#f59e0b",
            withdraw: "#1a2639"
        },
        ui: {
            bgDark: "#1f2937",
            bgMedium: "#374151",
            borderColor: "rgba(59,130,246,0.2)",
            textSecondary: "#9ca3af"
        }
    }
}));

// Mock timers
jest.useFakeTimers();

describe("useTurnNotification", () => {
    let originalTitle: string;
    let mockAudio: any;
    let mockFavicon: HTMLLinkElement;
    let mockCanvas: any;
    let mockContext: any;
    let originalCreateElement: typeof document.createElement;
    let OriginalAudio: typeof Audio;

    beforeEach(() => {
        originalTitle = document.title;
        document.title = "Block 52";

        // Create mock favicon
        mockFavicon = document.createElement("link");
        mockFavicon.rel = "icon";
        mockFavicon.href = "/b52favicon.svg";
        document.head.appendChild(mockFavicon);

        // Mock canvas context
        mockContext = {
            beginPath: jest.fn(),
            arc: jest.fn(),
            fill: jest.fn(),
            stroke: jest.fn(),
            fillRect: jest.fn(),
            strokeRect: jest.fn(),
            fillStyle: "",
            strokeStyle: "",
            lineWidth: 0
        };

        mockCanvas = {
            width: 0,
            height: 0,
            getContext: jest.fn(() => mockContext),
            toDataURL: jest.fn(() => "data:image/png;base64,mock")
        };

        // Save original createElement
        originalCreateElement = document.createElement.bind(document);

        // Mock createElement to return mock canvas
        document.createElement = jest.fn((tag: string) => {
            if (tag === "canvas") {
                return mockCanvas as any;
            }
            return originalCreateElement(tag);
        }) as any;

        // Mock Audio
        mockAudio = {
            volume: 0,
            play: jest.fn().mockResolvedValue(undefined)
        };

        OriginalAudio = global.Audio;
        (global as any).Audio = jest.fn(() => mockAudio);
    });

    afterEach(() => {
        document.title = originalTitle;
        mockFavicon.remove();
        // Restore original createElement
        document.createElement = originalCreateElement;
        // Restore original Audio
        (global as any).Audio = OriginalAudio;
        jest.clearAllTimers();
        jest.clearAllMocks();
    });

    it("should not flash favicon when isUserTurn is false", () => {
        const originalHref = mockFavicon.href;
        renderHook(() => useTurnNotification(false));
        
        // Advance timers
        jest.advanceTimersByTime(2000);
        
        // Favicon should remain unchanged
        expect(mockFavicon.href).toContain("/b52favicon.svg");
    });

    it("should flash favicon when isUserTurn is true and tab is hidden", () => {
        // Mock document.hidden
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true
        });

        const originalHref = mockFavicon.href;
        renderHook(() => useTurnNotification(true));
        
        // Initial favicon should still be original
        expect(mockFavicon.href).toContain("/b52favicon.svg");
        
        // After flash interval, favicon should change to colored version
        jest.advanceTimersByTime(1000);
        expect(mockFavicon.href).toContain("data:image/png");
        
        // After another interval, favicon should alternate back
        jest.advanceTimersByTime(1000);
        expect(mockFavicon.href).toContain("/b52favicon.svg");
    });

    it("should stop flashing when turn ends", () => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true
        });

        const { rerender } = renderHook(
            ({ isUserTurn }) => useTurnNotification(isUserTurn),
            { initialProps: { isUserTurn: true } }
        );
        
        jest.advanceTimersByTime(1000);
        expect(mockFavicon.href).toContain("data:image/png");
        
        // Turn ends
        rerender({ isUserTurn: false });
        
        // Favicon should be restored
        expect(mockFavicon.href).toContain("/b52favicon.svg");
        
        // Should not continue flashing
        jest.advanceTimersByTime(2000);
        expect(mockFavicon.href).toContain("/b52favicon.svg");
    });

    it("should play notification sound when enabled", () => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true
        });

        renderHook(() => useTurnNotification(true, { enableSound: true }));
        
        // Audio should be created and played
        expect((global as any).Audio).toHaveBeenCalledWith("/chip-notification.mp3");
        expect(mockAudio.play).toHaveBeenCalled();
    });

    it("should not play notification sound when disabled", () => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true
        });

        renderHook(() => useTurnNotification(true, { enableSound: false }));
        
        // Audio should not be created
        expect((global as any).Audio).not.toHaveBeenCalled();
    });

    it("should use custom flash interval", () => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true
        });

        renderHook(() => useTurnNotification(true, { flashInterval: 500 }));
        
        expect(mockFavicon.href).toContain("/b52favicon.svg");
        
        // Should flash after custom interval
        jest.advanceTimersByTime(500);
        expect(mockFavicon.href).toContain("data:image/png");
        
        jest.advanceTimersByTime(500);
        expect(mockFavicon.href).toContain("/b52favicon.svg");
    });

    it("should not flash when tab is visible", () => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => false
        });

        renderHook(() => useTurnNotification(true));
        
        jest.advanceTimersByTime(2000);
        
        // Should not flash when tab is visible
        expect(mockFavicon.href).toContain("/b52favicon.svg");
    });

    it("should restore favicon on unmount", () => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true
        });

        const { unmount } = renderHook(() => useTurnNotification(true));
        
        jest.advanceTimersByTime(1000);
        expect(mockFavicon.href).toContain("data:image/png");
        
        unmount();
        
        expect(mockFavicon.href).toContain("/b52favicon.svg");
    });

    it("should constrain soundVolume to valid range", () => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true
        });

        // Test with volume > 1 (should be clamped to 1.0)
        renderHook(() => useTurnNotification(true, { soundVolume: 2.0 }));
        expect((global as any).Audio).toHaveBeenCalledWith("/chip-notification.mp3");
        expect(mockAudio.volume).toBe(1.0);

        // Test with volume < 0 (should be clamped to 0.0)
        jest.clearAllMocks();
        mockAudio.volume = 0;
        renderHook(() => useTurnNotification(true, { soundVolume: -0.5 }));
        expect((global as any).Audio).toHaveBeenCalledWith("/chip-notification.mp3");
        expect(mockAudio.volume).toBe(0.0);
    });

    it("should constrain flashInterval to minimum value", () => {
        Object.defineProperty(document, "hidden", {
            configurable: true,
            get: () => true
        });

        // Test with very small interval (should be constrained to 200ms minimum)
        renderHook(() => useTurnNotification(true, { flashInterval: 50 }));
        
        expect(mockFavicon.href).toContain("/b52favicon.svg");
        
        // Should use minimum interval of 200ms, not 50ms
        jest.advanceTimersByTime(50);
        expect(mockFavicon.href).toContain("/b52favicon.svg");
        
        jest.advanceTimersByTime(150);
        expect(mockFavicon.href).toContain("data:image/png");
    });
});

describe("createFaviconNotification", () => {
    let mockFavicon: HTMLLinkElement;
    let mockCanvas: any;
    let mockContext: any;
    let originalCreateElement: typeof document.createElement;

    beforeEach(() => {
        // Create mock favicon
        mockFavicon = document.createElement("link");
        mockFavicon.rel = "icon";
        mockFavicon.href = "/b52favicon.svg";
        document.head.appendChild(mockFavicon);

        // Mock canvas
        mockContext = {
            beginPath: jest.fn(),
            arc: jest.fn(),
            fill: jest.fn(),
            stroke: jest.fn(),
            fillStyle: "",
            strokeStyle: "",
            lineWidth: 0
        };

        mockCanvas = {
            width: 0,
            height: 0,
            getContext: jest.fn(() => mockContext),
            toDataURL: jest.fn(() => "data:image/png;base64,mock")
        };

        // Save original createElement for restoration
        originalCreateElement = document.createElement.bind(document);
        
        document.createElement = jest.fn((tag: string) => {
            if (tag === "canvas") {
                return mockCanvas as any;
            }
            return originalCreateElement(tag);
        }) as any;
    });

    afterEach(() => {
        mockFavicon.remove();
        // Explicitly restore createElement
        document.createElement = originalCreateElement;
        jest.restoreAllMocks();
    });

    it("should modify favicon when notification is active", () => {
        createFaviconNotification(true);
        
        expect(mockCanvas.getContext).toHaveBeenCalledWith("2d");
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.arc).toHaveBeenCalledWith(26, 6, 6, 0, 2 * Math.PI);
        expect(mockContext.fillStyle).toBe("#3b82f6");
        expect(mockCanvas.toDataURL).toHaveBeenCalledWith("image/png");
    });

    it("should restore original favicon when notification is inactive", () => {
        mockFavicon.href = "data:image/png;base64,modified";
        
        createFaviconNotification(false);
        
        expect(mockFavicon.href).toContain("/b52favicon.svg");
    });

    it("should handle missing favicon gracefully", () => {
        mockFavicon.remove();
        
        expect(() => {
            createFaviconNotification(true);
        }).not.toThrow();
    });
});
