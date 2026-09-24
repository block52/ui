import React from "react";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

// poker-vm#2097 — a throw inside the boundary shows an error page; siblings
// outside it (the header) keep rendering instead of the whole app unmounting.
const Boom: React.FC = () => {
    throw new Error("gameOptions.nextSmallBlind is required for SNG/Tournament games");
};

describe("ErrorBoundary", () => {
    let errorSpy: jest.SpyInstance;
    beforeEach(() => {
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => errorSpy.mockRestore());

    it("renders children when nothing throws", () => {
        render(<ErrorBoundary><p>table</p></ErrorBoundary>);
        expect(screen.getByText("table")).toBeInTheDocument();
    });

    it("contains a render throw: shows the message + Reload, and the header outside survives", () => {
        render(
            <div>
                <header>GlobalHeader</header>
                <ErrorBoundary>
                    <Boom />
                </ErrorBoundary>
            </div>
        );
        expect(screen.getByText("GlobalHeader")).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong on this page");
        expect(screen.getByText(/nextSmallBlind is required/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
        expect(errorSpy.mock.calls.some(c => c[0] === "[ErrorBoundary] page crashed:")).toBe(true);
    });

    it("shows the component stack only when showDetails is set", () => {
        const { unmount } = render(<ErrorBoundary><Boom /></ErrorBoundary>);
        expect(document.querySelectorAll("pre")).toHaveLength(1);
        unmount();
        render(<ErrorBoundary showDetails><Boom /></ErrorBoundary>);
        expect(document.querySelectorAll("pre")).toHaveLength(2);
    });
});
