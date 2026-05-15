// Must be first import for browser polyfills
import "./polyfills";

import { createRoot } from "react-dom/client";
import "./index.css";
import "react-toastify/dist/ReactToastify.css";
import App from "./App";
import { Profiler } from "react";
import { NetworkProvider } from "./context/NetworkContext";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { getCosmosMnemonic, setCosmosMnemonic, setCosmosAddress } from "./utils/cosmos/storage";


const projectId = import.meta.env.VITE_PROJECT_ID;
if (!projectId) {
    throw new Error("Project ID is not defined in .env file");
}

// block52/ui#377 — auto-generate a Cosmos wallet on first visit. Done
// before React mounts so the first render of useCosmosWallet (and any
// other consumer that only reads localStorage on mount) sees the new
// mnemonic. Doing this inside a component is a race: the hook's mount
// effect would already have read null by the time generation finished.
if (!getCosmosMnemonic()) {
    try {
        const wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: "b52" });
        const [account] = await wallet.getAccounts();
        setCosmosMnemonic(wallet.mnemonic);
        setCosmosAddress(account.address);
    } catch (err) {
        console.error("Failed to auto-generate Cosmos wallet:", err);
    }
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
