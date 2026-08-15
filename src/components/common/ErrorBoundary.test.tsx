import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "./ErrorBoundary";

// React always logs an error when a component throws inside an
// ErrorBoundary, even when the boundary handles it. Silence those
// for the duration of the test so the test output stays clean.
const originalError = console.error;
beforeEach(() => {
    console.error = jest.fn();
});
afterEach(() => {
    console.error = originalError;
});

const Boom: React.FC<{ message?: string }> = ({ message = "kaboom" }) => {
    throw new Error(message);
};

const Ok: React.FC = () => <div>healthy child</div>;

describe("ErrorBoundary", () => {
    it("renders children when nothing throws", () => {
        render(
            <ErrorBoundary>
                <Ok />
            </ErrorBoundary>
        );
        expect(screen.getByText("healthy child")).toBeInTheDocument();
    });

    it("renders the fallback when a child throws", () => {
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        );
        expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /reload/i })).toBeInTheDocument();
    });

    it("logs to console with the [ErrorBoundary] marker", () => {
        const spy = console.error as jest.Mock;
        render(
            <ErrorBoundary>
                <Boom message="grep me" />
            </ErrorBoundary>
        );
        // Look for a call where the first arg starts with our marker.
        const matched = spy.mock.calls.some(
            args => typeof args[0] === "string" && args[0].includes("[ErrorBoundary]")
        );
        expect(matched).toBe(true);
    });

    it("reload button is enabled and clickable", async () => {
        // jsdom doesn't permit redefining window.location, so we don't
        // assert the side-effect — just that the button is reachable
        // and click doesn't throw.
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        );
        const button = screen.getByRole("button", { name: /reload/i });
        expect(button).toBeEnabled();
        await userEvent.click(button);
    });
});
