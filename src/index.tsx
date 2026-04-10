// Must be first import for browser polyfills
import "./polyfills";

import { createRoot } from "react-dom/client";
import "./index.css";
import "react-toastify/dist/ReactToastify.css";
import App from "./App";
import { Profiler } from "react";
import { NetworkProvider } from "./context/NetworkContext";


const projectId = import.meta.env.VITE_PROJECT_ID;
if (!projectId) {
    throw new Error("Project ID is not defined in .env file");
}

const root = createRoot(document.getElementById("app") as HTMLElement);

function onRenderCallback(
    _id: string,
    _phase: "mount" | "update" | "nested-update",
    _actualDuration: number,
    _baseDuration: number,
    _startTime: number,
    _commitTime: number
) {
    // Performance metrics callback - metrics can be collected here if needed
}

root.render(
    // React StrictMode is temporarily disabled because it causes effects to run twice in development,
    // which creates rapid WebSocket connect/disconnect cycles. This leads to:
    // 1. Multiple subscription attempts to the same table
    // 2. Premature connection closures due to callback cleanup
    // 3. Unstable real-time data flow
    // The WebSocket singleton has debouncing to handle some re-renders, but StrictMode's
    // double-execution pattern is too aggressive for real-time connections.
    // TODO: Re-enable StrictMode and improve WebSocket resilience for production
    // <React.StrictMode>
    <NetworkProvider>
        <Profiler id="AppRoot" onRender={onRenderCallback}>
            <App />
        </Profiler>
    </NetworkProvider>
    // </React.StrictMode>
);
