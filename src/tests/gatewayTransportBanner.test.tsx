import React from "react";
import { render, screen } from "@testing-library/react";

import { GatewayTransportBanner } from "../components/GatewayTransportBanner";

// jest maps utils/viteEnv to process.env (see jest.config.js).
describe("GatewayTransportBanner", () => {
    const saved = {
        transport: process.env.VITE_GAME_TRANSPORT,
        url: process.env.VITE_GATEWAY_URL,
        show: process.env.VITE_SHOW_BANNER
    };

    const restore = (key: string, value: string | undefined) => {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    };

    afterEach(() => {
        restore("VITE_GAME_TRANSPORT", saved.transport);
        restore("VITE_GATEWAY_URL", saved.url);
        restore("VITE_SHOW_BANNER", saved.show);
    });

    it("is hidden by default (ui#494) even on the gateway transport", () => {
        process.env.VITE_GAME_TRANSPORT = "gateway"; // chain is the default now (#2469)
        delete process.env.VITE_SHOW_BANNER;
        process.env.VITE_GATEWAY_URL = "https://pvm.block52.xyz/gateway";
        render(<GatewayTransportBanner />);
        expect(screen.queryByTestId("gateway-transport-banner")).toBeNull();
    });

    it("shows when VITE_SHOW_BANNER=true on the gateway transport", () => {
        process.env.VITE_GAME_TRANSPORT = "gateway"; // opt back in to the legacy path
        process.env.VITE_SHOW_BANNER = "true";
        process.env.VITE_GATEWAY_URL = "https://pvm.block52.xyz/gateway";
        render(<GatewayTransportBanner />);
        const banner = screen.getByTestId("gateway-transport-banner");
        expect(banner.textContent).toContain("gateway transport");
        expect(banner.textContent).toContain("https://pvm.block52.xyz/gateway");
    });

    it("renders nothing on chain transport even when VITE_SHOW_BANNER=true", () => {
        process.env.VITE_GAME_TRANSPORT = "chain";
        process.env.VITE_SHOW_BANNER = "true";
        render(<GatewayTransportBanner />);
        expect(screen.queryByTestId("gateway-transport-banner")).toBeNull();
    });
});
