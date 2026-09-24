import React from "react";

type ErrorBoundaryProps = {
    children: React.ReactNode;
    /** Show the component stack in the fallback (dev builds only — App passes import.meta.env.DEV). */
    showDetails?: boolean;
};

type ErrorBoundaryState = {
    error: Error | null;
    componentStack: string | null;
};

/**
 * Catches a render-time throw inside the page area so ONE broken page (or a
 * browser extension's content script throwing into our tree) shows an error
 * page instead of unmounting the whole app to a white screen (poker-vm#2097).
 *
 * App wraps <Routes> with it and keys it by pathname, so navigating to another
 * route resets it — the header and navigation stay up throughout.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null, componentStack: null };

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        // A clear marker, so a future "blank page" is one console search away.
        console.error("[ErrorBoundary] page crashed:", error, info.componentStack);
        this.setState({ componentStack: info.componentStack ?? null });
    }

    private handleReload = (): void => {
        window.location.reload();
    };

    render(): React.ReactNode {
        const { error, componentStack } = this.state;
        if (!error) {
            return this.props.children;
        }
        return (
            <div role="alert" className="max-w-xl mx-auto mt-16 px-4 text-white">
                <h1 className="text-2xl font-bold mb-2">Something went wrong on this page</h1>
                <p className="text-gray-300 mb-4">
                    The rest of the app is still working — reload to try again, or use the menu to go elsewhere.
                </p>
                <pre className="bg-gray-900 text-red-300 text-sm p-3 rounded-lg whitespace-pre-wrap break-words mb-4">{error.message}</pre>
                {this.props.showDetails && componentStack && (
                    <pre className="bg-gray-900 text-gray-400 text-xs p-3 rounded-lg whitespace-pre-wrap break-words mb-4 max-h-64 overflow-auto">
                        {componentStack}
                    </pre>
                )}
                <button
                    type="button"
                    onClick={this.handleReload}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                    Reload
                </button>
            </div>
        );
    }
}

export default ErrorBoundary;
