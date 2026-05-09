import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Top-level ErrorBoundary that prevents a single unhandled throw from
 * unmounting the entire React tree to a blank white page.
 *
 * Triggers we know hit this in the wild:
 *   - Phantom + MetaMask extension SES collision throws inside an
 *     extension content script during page-load and the unhandled
 *     error bubbles into our app (#2097).
 *   - Strict-by-design throws inside hooks like useBlindLevel when the
 *     chain stops sending a required field (Commandment 7).
 *
 * Without this boundary, prod builds silently unmount everything and
 * the user sees `<div id="root"></div>` with no diagnostic. Inside this
 * boundary, the user gets a fallback page they can read + a Reload
 * button, and the error is logged to the console with a clear marker.
 *
 * Wraps `Routes` (not the providers) so that the error doesn't take
 * down the WagmiProvider, QueryClient, or other globally-scoped
 * context — only the visible page replaces with the fallback.
 */
class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // Marker tag so it's grep-able in production logs / Sentry without
        // ambiguity vs other "TypeError: ..." entries.
        console.error("[ErrorBoundary] uncaught render error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleReload = (): void => {
        window.location.reload();
    };

    render(): ReactNode {
        const { error, errorInfo } = this.state;
        if (!error) {
            return this.props.children;
        }

        // Vite replaces NODE_ENV at build time; works in Jest test env too.
        const isDev = process.env.NODE_ENV !== "production";

        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2rem",
                    background: "#2c3245",
                    color: "#e1d7d5",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                }}
            >
                <div
                    style={{
                        maxWidth: "640px",
                        width: "100%",
                        background: "rgba(0,0,0,0.35)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        padding: "1.75rem",
                    }}
                >
                    <h1 style={{ margin: 0, fontSize: "1.4rem", color: "#ff6b6b" }}>
                        Something went wrong
                    </h1>
                    <p style={{ marginTop: "0.75rem", color: "#aaa", fontSize: "0.95rem" }}>
                        The page hit an unexpected error and stopped rendering. This is usually
                        a transient issue — reloading often fixes it. If it persists, the
                        error details below help us diagnose.
                    </p>
                    <button
                        type="button"
                        onClick={this.handleReload}
                        style={{
                            marginTop: "1.25rem",
                            padding: "0.625rem 1.25rem",
                            border: "none",
                            borderRadius: "8px",
                            background: "#d63c5e",
                            color: "#fff",
                            fontSize: "0.95rem",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        Reload page
                    </button>

                    {isDev && (
                        <details style={{ marginTop: "1.5rem", fontSize: "0.85rem" }} open>
                            <summary style={{ cursor: "pointer", color: "#bbb" }}>
                                Error details (dev only)
                            </summary>
                            <pre
                                style={{
                                    marginTop: "0.75rem",
                                    padding: "0.75rem",
                                    background: "rgba(0,0,0,0.4)",
                                    borderRadius: "6px",
                                    overflow: "auto",
                                    fontSize: "0.8rem",
                                    color: "#ff9b9b",
                                    whiteSpace: "pre-wrap",
                                    wordBreak: "break-word",
                                }}
                            >
                                {error.message}
                                {error.stack ? "\n\n" + error.stack : ""}
                                {errorInfo?.componentStack
                                    ? "\n\nComponent stack:" + errorInfo.componentStack
                                    : ""}
                            </pre>
                        </details>
                    )}
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
