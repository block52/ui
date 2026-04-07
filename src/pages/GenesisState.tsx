import { useState, useEffect } from "react";
import useCosmosWallet from "../hooks/wallet/useCosmosWallet";
import { useNetwork } from "../context/NetworkContext";
import { toast } from "react-toastify";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { useCosmosApi } from "../context/CosmosApiContext";
import { AccountBalanceResponse, AccountsResponse, ValidatorsResponse } from "./explorer/AllAccountsPage";

interface GenesisAccount {
    address: string;
    accountNumber: string;
    sequence: string;
    balances: { denom: string; amount: string }[];
    isValidator?: boolean;
    moniker?: string;
}

interface WellKnownAccount {
    name: string;
    mnemonic: string;
    address?: string;
}

// Well-known test accounts from config.yml
const WELL_KNOWN_ACCOUNTS: WellKnownAccount[] = [
    {
        name: "alice",
        mnemonic:
            "cement shadow leave crash crisp aisle model hip lend february library ten cereal soul bind boil bargain barely rookie odor panda artwork damage reason"
    },
    {
        name: "bob",
        mnemonic:
            "vanish legend pelican blush control spike useful usage into any remove wear flee short october naive swear wall spy cup sort avoid agent credit"
    },
    {
        name: "charlie",
        mnemonic:
            "video short denial minimum vague arm dose parrot poverty saddle kingdom life buyer globe fashion topic vicious theme voice keep try jacket fresh potato"
    },
    {
        name: "diana",
        mnemonic:
            "twice bacon whale space improve galaxy liberty trumpet outside sunny action reflect doll hill ugly torch ride gossip snack fork talk market proud nothing"
    },
    {
        name: "eve",
        mnemonic:
            "raven mix autumn dismiss degree husband street slender maple muscle inch radar winner agent claw permit autumn expose power minute master scrub asthma retreat"
    }
];

export default function GenesisState() {
    const [accounts, setAccounts] = useState<GenesisAccount[]>([]);
    const [validators, setValidators] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [derivedAddresses, setDerivedAddresses] = useState<Map<string, string>>(new Map());
    const [bridgeState, setBridgeState] = useState<any>(null);
    const [loadingBridgeState, setLoadingBridgeState] = useState(false);
    const cosmosWallet = useCosmosWallet();
    const cosmosAddress = cosmosWallet.address;
    const { currentNetwork } = useNetwork();
    const cosmosApi = useCosmosApi(currentNetwork.rest);

    // Use REST endpoint from selected network (NetworkSelector dropdown)
    const COSMOS_REST_URL = currentNetwork.rest;

    // Derive addresses from mnemonics on mount
    useEffect(() => {
        deriveAddresses();
    }, []);

    useEffect(() => {
        fetchGenesisState();
    }, []);

    const deriveAddresses = async () => {
        const addressMap = new Map<string, string>();

        for (const account of WELL_KNOWN_ACCOUNTS) {
            try {
                const wallet = await DirectSecp256k1HdWallet.fromMnemonic(account.mnemonic, {
                    prefix: "b52"
                });
                const [firstAccount] = await wallet.getAccounts();
                addressMap.set(account.name, firstAccount.address);
            } catch (err) {
                console.error(`Failed to derive address for ${account.name}:`, err);
            }
        }

        setDerivedAddresses(addressMap);
    };

    const fetchGenesisState = async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch all accounts
            const accountsResponse = (await cosmosApi.getAccounts(1000)) as AccountsResponse;

            const accountsData = accountsResponse.accounts;

            // Fetch validators
            const validatorsResponse = (await cosmosApi.getValidators()) as ValidatorsResponse;
            setValidators(validatorsResponse.validators || []);

            // Process accounts and fetch balances
            const processedAccounts: GenesisAccount[] = [];

            for (const account of accountsData || []) {
                const address = account.address || account.base_account?.address;
                if (!address) continue;

                // Fetch balance for this account
                const balanceResponse = (await cosmosApi.getBalanceByAddress(address)) as AccountBalanceResponse;
                const balanceData = balanceResponse.balances || [];

                // Check if this is a validator
                const validator = validatorsResponse.validators?.find(
                    (v: any) => v.operator_address && address.startsWith("b52") && v.operator_address.replace("b52valoper", "b52") === address
                );

                processedAccounts.push({
                    address,
                    accountNumber: account.account_number || account.base_account?.account_number || "0",
                    sequence: account.sequence || account.base_account?.sequence || "0",
                    balances: balanceData || [],
                    isValidator: !!validator,
                    moniker: validator?.description?.moniker
                });
            }

            setAccounts(processedAccounts);
        } catch (err) {
            console.error("Failed to fetch genesis state:", err);
            setError(err instanceof Error ? err.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    const fetchBridgeState = async () => {
        setLoadingBridgeState(true);
        try {
            // Fetch withdrawal requests
            // Backend not yet Implemented
            const withdrawalsResponse = await fetch(`${COSMOS_REST_URL}/pokerchain/poker/withdrawal_requests`);
            const withdrawalsData = withdrawalsResponse.ok ? await withdrawalsResponse.json() : { withdrawal_requests: [] };

            // Fetch processed ETH transactions (if endpoint exists)
            // const processedTxsResponse = await fetch(`${COSMOS_REST_URL}/pokerchain/poker/processed_eth_txs`);
            // const processedTxsData = processedTxsResponse.ok ? await processedTxsResponse.json() : { processed_eth_txs: [] };

            const state = {
                withdrawal_requests: withdrawalsData.withdrawal_requests || []
                // processed_eth_txs: processedTxsData.processed_eth_txs || []
            };

            setBridgeState(state);
            toast.success("Bridge state loaded successfully");
        } catch (err) {
            console.error("Failed to fetch bridge state:", err);
            toast.error("Failed to load bridge state");
        } finally {
            setLoadingBridgeState(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard!`);
    };

    const formatAmount = (amount: string, denom: string): string => {
        const num = BigInt(amount);
        if (denom === "usdc") {
            // USDC has 6 decimals
            const wholePart = num / BigInt(1_000_000);
            const decimalPart = num % BigInt(1_000_000);
            return `${wholePart.toLocaleString()}.${decimalPart.toString().padStart(6, "0")} USDC`;
        } else if (denom === "stake" || denom === "b52Token") {
            // Stake has 18 decimals (or whatever you use)
            const wholePart = num / BigInt(1_000_000);
            const decimalPart = num % BigInt(1_000_000);
            return `${wholePart.toLocaleString()}.${decimalPart.toString().padStart(6, "0")} ${denom}`;
        }
        return `${num.toLocaleString()} ${denom}`;
    };

    const shortenAddress = (address: string): string => {
        return `${address.slice(0, 12)}...${address.slice(-8)}`;
    };

    const isMyWallet = (address: string): boolean => {
        return cosmosAddress?.toLowerCase() === address.toLowerCase();
    };

    const myWalletInGenesis = accounts.some(acc => isMyWallet(acc.address));

    if (loading) {
        return (
            <div className="min-h-screen p-8 relative">
                <AnimatedBackground />
                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="text-center text-white text-xl">Loading genesis state...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen p-8 relative">
                <AnimatedBackground />
                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="bg-red-900/30 border border-red-500 rounded-lg p-6">
                        <h2 className="text-red-400 text-xl font-bold mb-2">Error Loading Genesis State</h2>
                        <p className="text-red-300">{error}</p>
                        <button onClick={fetchGenesisState} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />
            <div className="max-w-7xl mx-auto space-y-8 relative z-10">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 rounded-lg p-8 border border-blue-500/30 text-center">
                    <h1 className="text-4xl font-bold text-white mb-2">🔷 Genesis State - Block 0</h1>
                    <p className="text-gray-300">Initial blockchain state when the chain was started. Shows which accounts exist from genesis.</p>
                </div>

                {/* Your Wallet Status */}
                {cosmosAddress && (
                    <div className={`rounded-lg p-6 border-2 ${myWalletInGenesis ? "bg-green-900/20 border-green-500" : "bg-yellow-900/20 border-yellow-500"}`}>
                        <h2 className="text-xl font-bold text-white mb-3">🔐 Your Connected Wallet</h2>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400">Address:</span>
                                <code className="text-white font-mono text-sm bg-black/30 px-2 py-1 rounded">{cosmosAddress}</code>
                                <button onClick={() => copyToClipboard(cosmosAddress, "Address")} className="text-blue-400 hover:text-blue-300 text-sm">
                                    📋 Copy
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400 pl-3">Status:</span>
                                {myWalletInGenesis ? (
                                    <span className="text-green-400 font-semibold">✅ In Genesis (has funds)</span>
                                ) : (
                                    <span className="text-yellow-400 font-semibold">❌ NOT in Genesis (needs tokens)</span>
                                )}
                            </div>
                            {!myWalletInGenesis && (
                                <div className="mt-3 p-4 bg-yellow-900/30 border border-yellow-600 rounded">
                                    <p className="text-yellow-200 text-sm">
                                        💡 <strong>Tip:</strong> Your wallet doesn't have any tokens. Import one of the test account mnemonics below to get
                                        started!
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Genesis Accounts */}
                <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                    <h2 className="text-2xl font-bold text-white mb-4">📊 Genesis Accounts ({accounts.length})</h2>

                    <div className="space-y-4">
                        {accounts.map((account, index) => (
                            <div
                                key={account.address}
                                className={`bg-gray-900/50 rounded-lg p-5 border ${
                                    isMyWallet(account.address)
                                        ? "border-green-500 bg-green-900/10"
                                        : account.isValidator
                                          ? "border-purple-500 bg-purple-900/10"
                                          : "border-gray-600"
                                }`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg font-bold text-white">
                                                {account.isValidator ? "👑 Validator" : `Account ${index + 1}`}
                                                {account.moniker && ` - ${account.moniker}`}
                                            </span>
                                            {isMyWallet(account.address) && <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">YOU</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <code className="text-sm text-gray-300 font-mono break-all">{account.address}</code>
                                            <button
                                                onClick={() => copyToClipboard(account.address, "Address")}
                                                className="text-blue-400 hover:text-blue-300 text-xs flex-shrink-0"
                                            >
                                                📋
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Balances */}
                                <div className="mt-3">
                                    <h4 className="text-sm text-gray-400 mb-2">Balances:</h4>
                                    {account.balances.length > 0 ? (
                                        <div className="space-y-1">
                                            {account.balances.map(balance => (
                                                <div key={balance.denom} className="flex items-center gap-2">
                                                    <span className="text-white font-semibold">{formatAmount(balance.amount, balance.denom)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-gray-500 text-sm">No balances</span>
                                    )}
                                </div>

                                {/* Account metadata */}
                                <div className="mt-3 flex gap-4 text-xs text-gray-500">
                                    <span>Account #: {account.accountNumber}</span>
                                    <span>Sequence: {account.sequence}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Well-Known Test Accounts */}
                <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg p-6 border border-purple-500/30">
                    <h2 className="text-2xl font-bold text-white mb-4">🔑 Well-Known Test Accounts</h2>
                    <p className="text-gray-300 mb-4">These accounts are from config.yml. Import their mnemonics to get instant access to test tokens!</p>

                    <div className="space-y-4">
                        {WELL_KNOWN_ACCOUNTS.map(wellKnown => {
                            const derivedAddress = derivedAddresses.get(wellKnown.name);

                            // Try to find this account in genesis using derived address
                            const genesisAccount = derivedAddress ? accounts.find(acc => acc.address === derivedAddress) : null;

                            const isMyWalletAccount = derivedAddress && cosmosAddress?.toLowerCase() === derivedAddress.toLowerCase();

                            return (
                                <div
                                    key={wellKnown.name}
                                    className={`bg-gray-900/50 rounded-lg p-4 border ${
                                        isMyWalletAccount ? "border-green-500 bg-green-900/10" : genesisAccount ? "border-blue-500/50" : "border-gray-600"
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-lg font-bold text-white capitalize">{wellKnown.name}</h3>
                                                {isMyWalletAccount && <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">YOU</span>}
                                                {genesisAccount ? (
                                                    <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">✅ In Genesis</span>
                                                ) : (
                                                    <span className="px-2 py-1 bg-yellow-600 text-white text-xs rounded-full">⚠️ Not in Genesis</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400">Test account from config.yml</p>

                                            {/* Show derived address */}
                                            {derivedAddress && (
                                                <div className="mt-2 flex items-start gap-2">
                                                    <span className="text-xs text-gray-500 pt-1 flex-shrink-0">Address:</span>
                                                    <code className="text-xs text-gray-300 font-mono bg-black/40 px-2 py-1 rounded break-all flex-1">
                                                        {derivedAddress}
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard(derivedAddress, `${wellKnown.name} address`)}
                                                        className="text-blue-400 hover:text-blue-300 text-xs flex-shrink-0"
                                                    >
                                                        📋
                                                    </button>
                                                </div>
                                            )}

                                            {/* Show balances if account is in genesis */}
                                            {genesisAccount && genesisAccount.balances.length > 0 && (
                                                <div className="mt-2">
                                                    <span className="text-xs text-gray-500">Balances: </span>
                                                    {genesisAccount.balances.map((bal, idx) => (
                                                        <span key={bal.denom} className="text-xs text-green-400 font-semibold">
                                                            {formatAmount(bal.amount, bal.denom)}
                                                            {idx < genesisAccount.balances.length - 1 ? ", " : ""}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-xs text-gray-400 mb-1 block">Mnemonic (BIP39):</label>
                                            <div className="flex items-start gap-2">
                                                <code className="text-xs text-gray-300 font-mono bg-black/40 px-3 py-2 rounded flex-1 break-all">
                                                    {wellKnown.mnemonic}
                                                </code>
                                                <button
                                                    onClick={() => copyToClipboard(wellKnown.mnemonic, `${wellKnown.name} mnemonic`)}
                                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded whitespace-nowrap"
                                                >
                                                    📋 Copy
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-2 p-3 bg-blue-900/20 border border-blue-600/30 rounded">
                                            <p className="text-xs text-blue-200">
                                                💡 <strong>How to use:</strong> Copy the mnemonic above and import it into your Keplr wallet or Block52 wallet
                                                to access this test account.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Validators Info */}
                {validators.length > 0 && (
                    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                        <h2 className="text-2xl font-bold text-white mb-4">👑 Validators ({validators.length})</h2>
                        <div className="space-y-3">
                            {validators.map(validator => (
                                <div key={validator.operator_address} className="bg-purple-900/20 border border-purple-600/30 rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-white font-semibold">{validator.description?.moniker || "Unknown Validator"}</h3>
                                            <code className="text-xs text-gray-400 font-mono">{validator.operator_address}</code>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-gray-400">Status</div>
                                            <div
                                                className={`text-sm font-semibold ${
                                                    validator.status === "BOND_STATUS_BONDED" ? "text-green-400" : "text-yellow-400"
                                                }`}
                                            >
                                                {validator.status === "BOND_STATUS_BONDED" ? "✅ Bonded" : "⚠️ Unbonded"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Bridge State Export/Import Section */}
                <div className="bg-orange-900/20 border border-orange-600/30 rounded-lg p-6">
                    <h2 className="text-2xl font-bold text-orange-400 mb-4">🌉 Bridge State Export (For Chain Reset)</h2>

                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4">
                        <h3 className="text-lg font-semibold text-white mb-2">⚠️ Why Export Bridge State?</h3>
                        <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                            <li>
                                Withdrawals are <strong>real USDC</strong> transactions on Ethereum
                            </li>
                            <li>If you reset the Block52 chain, withdrawal records will be lost</li>
                            <li>But Ethereum still knows about those nonces - must preserve them!</li>
                            <li>Export before reset, then import into new genesis to maintain integrity</li>
                        </ul>
                    </div>

                    <div className="flex gap-4 mb-4">
                        <button
                            onClick={fetchBridgeState}
                            disabled={loadingBridgeState}
                            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold disabled:opacity-50"
                        >
                            {loadingBridgeState ? "Loading..." : "📥 Load Current Bridge State"}
                        </button>
                    </div>

                    {bridgeState && (
                        <div className="space-y-4">
                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3">
                                    <div className="text-sm text-gray-400">Withdrawal Requests</div>
                                    <div className="text-2xl font-bold text-blue-400">{bridgeState.withdrawal_requests?.length || 0}</div>
                                </div>
                                <div className="bg-green-900/20 border border-green-600/30 rounded-lg p-3">
                                    <div className="text-sm text-gray-400">Processed ETH Txs</div>
                                    <div className="text-2xl font-bold text-green-400">{bridgeState.processed_eth_txs?.length || 0}</div>
                                </div>
                            </div>

                            {/* Genesis JSON */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-lg font-semibold text-white">📋 Genesis JSON (Poker Module State)</h3>
                                    <button
                                        onClick={() => copyToClipboard(JSON.stringify(bridgeState, null, 2), "Bridge state")}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm"
                                    >
                                        📋 Copy JSON
                                    </button>
                                </div>
                                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto">
                                    <pre className="text-xs text-gray-300 font-mono">{JSON.stringify(bridgeState, null, 2)}</pre>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-blue-400 mb-3">📖 How to Import into New Genesis</h3>
                                <ol className="list-decimal list-inside text-sm text-gray-300 space-y-2">
                                    <li>
                                        <strong>Copy the JSON above</strong> (click "Copy JSON" button)
                                    </li>
                                    <li>
                                        <strong>Stop the chain</strong> (Ctrl+C in terminal)
                                    </li>
                                    <li>
                                        <strong>Reset testnet data:</strong>
                                        <code className="block bg-gray-800 text-xs p-2 mt-1 rounded font-mono">
                                            ./run-local-testnet.sh → Option 7 (Clean & Reset)
                                        </code>
                                    </li>
                                    <li>
                                        <strong>Initialize new chain:</strong>
                                        <code className="block bg-gray-800 text-xs p-2 mt-1 rounded font-mono">
                                            ./run-local-testnet.sh → Option 1 (Initialize)
                                        </code>
                                    </li>
                                    <li>
                                        <strong>Edit genesis.json before starting:</strong>
                                        <code className="block bg-gray-800 text-xs p-2 mt-1 rounded font-mono">
                                            vi ~/.pokerchain-testnet/node1/config/genesis.json
                                        </code>
                                    </li>
                                    <li>
                                        <strong>Find the poker module section:</strong> Look for <code className="bg-gray-800 px-1">"poker": &#123;</code>
                                    </li>
                                    <li>
                                        <strong>Paste the copied JSON</strong> into the poker module section (replace existing withdrawal_requests)
                                    </li>
                                    <li>
                                        <strong>Save and start the chain</strong> → Option 2 (Start Node 1)
                                    </li>
                                </ol>
                            </div>
                        </div>
                    )}
                </div>

                {/* Refresh Button */}
                <div className="flex justify-center">
                    <button onClick={fetchGenesisState} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold">
                        🔄 Refresh Genesis State
                    </button>
                </div>
            </div>

            {/* Powered by Block52 */}
            <div className="fixed bottom-4 left-4 flex items-center z-10 opacity-30">
                <div className="flex flex-col items-start bg-transparent px-3 py-2 rounded-lg backdrop-blur-sm border-0">
                    <div className="text-left mb-1">
                        <span className="text-xs text-white font-medium tracking-wide  ">POWERED BY</span>
                    </div>
                    <img src="/block52.png" alt="Block52 Logo" className="h-6 w-auto object-contain interaction-none" />
                </div>
            </div>
        </div>
    );
}
