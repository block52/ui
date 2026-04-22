import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Table from "./components/playPage/Table";
import { createAppKit } from "@reown/appkit/react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { projectId, metadata, networks, wagmiAdapter } from "./config";
import { base } from "@reown/appkit/networks";
import { ToastContainer } from "react-toastify";
import Dashboard from "./pages/Dashboard";
import CosmosWalletPage from "./components/CosmosWalletPage";
import BlocksPage from "./pages/explorer/BlocksPage";
import BlockDetailPage from "./pages/explorer/BlockDetailPage";
import TransactionPage from "./pages/explorer/TransactionPage";
import AddressPage from "./pages/explorer/AddressPage";
import AllAccountsPage from "./pages/explorer/AllAccountsPage";
import DistributionPage from "./pages/explorer/DistributionPage";
import HandReplayPage from "./pages/explorer/HandReplayPage";
import HandPage from "./pages/explorer/HandPage";
import TestSigningPage from "./pages/TestSigningPage";
import ManualBridgeTrigger from "./pages/ManualBridgeTrigger";
import BridgeAdminDashboard from "./pages/BridgeAdminDashboard";
import WithdrawalDashboard from "./pages/WithdrawalDashboard";
import TableAdminPage from "./pages/TableAdminPage";
import GenesisState from "./pages/GenesisState";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NodeStatusPage from "./pages/NodeStatusPage";
import NodesPage from "./pages/NodesPage";
import { TestSdk } from "./test-sdk";
import { GameStateProvider } from "./context/GameStateContext";
import { GameSettingsProvider } from "./context/GameSettingsContext";
import { generateCSSVariables } from "./utils/colorConfig";
import { useEffect, useState, lazy, Suspense } from "react";
import FaviconSetter from "./components/FaviconSetter";
import { GlobalHeader } from "./components/GlobalHeader";
import { ProfileAvatarProvider } from "./context/profile/ProfileAvatarContext";
import { ProfileAvatarModal } from "./components/profile";
import { PaymentApiProvider } from "./context/PaymentApiContext";
import { CosmosApiProvider } from "./context/CosmosApiContext";
import { IndexerApiProvider } from "./context/IndexerApiContext";

const queryClient = new QueryClient();

// Lazy-load debug modal (dev only)
const ChipDebugModal = lazy(() => import("./components/ChipDebugModal"));

// Create modal
createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    metadata,
    features: {
        socials: false,
        email: false,
        analytics: true
    },
    enableCoinbase: true,
    defaultNetwork: base,
    allWallets: "SHOW"
});

// Main App content to be wrapped with providers
function AppContent() {
    const [showChipDebug, setShowChipDebug] = useState(false);

    // Inject CSS variables on mount
    useEffect(() => {
        const style = document.createElement("style");
        style.innerHTML = generateCSSVariables();
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // Ctrl+Shift+D to toggle chip debug modal
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === "D") {
                e.preventDefault();
                setShowChipDebug(prev => !prev);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    return (
        <div className="bg-[#2c3245] min-h-screen">
            <FaviconSetter />
            <GlobalHeader />
            <ProfileAvatarModal />
            <Routes>
                <Route path="/test-sdk" element={<TestSdk />} />
                <Route path="/table/:id" element={<Table />} />
                <Route path="/table/admin" element={<TableAdminPage />} /> {/* Legacy - keep for backwards compat */}
                <Route path="/wallet" element={<CosmosWalletPage />} />
                {/* User-facing routes */}
                <Route path="/withdrawals" element={<WithdrawalDashboard />} />
                <Route path="/bridge/withdrawals" element={<WithdrawalDashboard />} />
                {/* Admin routes - consolidated under /admin */}
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/genesis" element={<GenesisState />} />
                <Route path="/admin/bridge" element={<BridgeAdminDashboard />} />
                <Route path="/admin/bridge-manual" element={<ManualBridgeTrigger />} />
                <Route path="/admin/tables" element={<TableAdminPage />} />
                <Route path="/admin/test-signing" element={<TestSigningPage />} />
                {/* Legacy routes - redirect to new admin paths */}
                <Route path="/test-signing" element={<TestSigningPage />} />
                <Route path="/bridge/manual" element={<ManualBridgeTrigger />} />
                <Route path="/bridge/admin" element={<BridgeAdminDashboard />} />
                <Route path="/genesis" element={<GenesisState />} />
                <Route path="/explorer" element={<BlocksPage />} />
                <Route path="/explorer/block/:height" element={<BlockDetailPage />} />
                <Route path="/explorer/tx/:hash" element={<TransactionPage />} />
                <Route path="/explorer/address" element={<AddressPage />} />
                <Route path="/explorer/address/:address" element={<AddressPage />} />
                <Route path="/explorer/accounts" element={<AllAccountsPage />} />
                <Route path="/explorer/distribution" element={<DistributionPage />} />
                <Route path="/explorer/hand/:gameId/:handNumber" element={<HandReplayPage />} />
                <Route path="/explorer/hand/:gameId" element={<HandPage />} />
                <Route path="/nodes" element={<NodesPage />} />
                <Route path="/node/:name" element={<NodeStatusPage />} />
                <Route path="/" element={<Dashboard />} />
            </Routes>
            <ToastContainer
                position="top-right"
                autoClose={false}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick={false}
                rtl={false}
                pauseOnFocusLoss={false}
                draggable
                pauseOnHover={false}
                closeButton={true}
                theme={"dark"}
            />
            {showChipDebug && (
                <Suspense fallback={null}>
                    <ChipDebugModal onClose={() => setShowChipDebug(false)} />
                </Suspense>
            )}
        </div>
    );
}

function App() {
    return (
        // Router should be the outermost wrapper
        <Router>
            <QueryClientProvider client={queryClient}>
                <WagmiProvider config={wagmiAdapter.wagmiConfig}>
                    <GameStateProvider>
                        <GameSettingsProvider>
                        <ProfileAvatarProvider>
                            <PaymentApiProvider>
                                <CosmosApiProvider>
                                    <IndexerApiProvider>
                                        <AppContent />
                                    </IndexerApiProvider>
                                </CosmosApiProvider>
                            </PaymentApiProvider>
                        </ProfileAvatarProvider>
                        </GameSettingsProvider>
                    </GameStateProvider>
                </WagmiProvider>
            </QueryClientProvider>
        </Router>
    );
}

export default App;
