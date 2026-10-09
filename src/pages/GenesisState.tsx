import { useState, useEffect } from "react";
import { truncateMiddle } from "../utils/stringUtils";
import { hasElements } from "../utils/guards";
import useCosmosWallet from "../hooks/wallet/useCosmosWallet";
import { useNetwork } from "../context/NetworkContext";
import { toast } from "react-toastify";
import { copyToClipboard as copyToClipboardUtil } from "../utils/clipboard";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Card, CardHeader, PillButton } from "../components/ui";
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
            // Fetch withdrawal requests. Backend endpoint is not yet implemented, so a
            // failure here (e.g. 404) is expected — treat it as an empty result set.
            let withdrawalRequests: any[] = [];
            try {
                const withdrawalsData = (await cosmosApi.getWithdrawalRequests()) as { withdrawal_requests?: any[] };
                withdrawalRequests = withdrawalsData.withdrawal_requests || [];
            } catch (withdrawalsErr) {
                console.error("Withdrawal requests endpoint unavailable (backend not yet implemented):", withdrawalsErr);
            }

            const state = {
                withdrawal_requests: withdrawalRequests
                // processed_eth_txs: [] — endpoint not yet implemented
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

    const copyToClipboard = (text: string, label: string) => copyToClipboardUtil(text, `${label} copied to clipboard!`);

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
        return truncateMiddle(address, 12, 8);
    };

    const isMyWallet = (address: string): boolean => {
        return cosmosAddress?.toLowerCase() === address.toLowerCase();
    };

    const myWalletInGenesis = accounts.some(acc => isMyWallet(acc.address));

    if (loading) {
        return (
            <div className="min-h-screen bg-surface-page text-ink-body">
                <main className="max-w-[1376px] mx-auto px-4 py-6 sm:px-8 sm:py-8">
                    <div className="text-center text-ink-muted text-lg">Loading genesis state...</div>
                </main>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-surface-page text-ink-body">
                <main className="max-w-[1376px] mx-auto px-4 py-6 sm:px-8 sm:py-8">
                    <Card className="p-6 border-red-400/40">
                        <h2 className="m-0 text-red-400 text-[17px] font-semibold mb-2">Error loading genesis state</h2>
                        <p className="text-ink-soft break-words">{error}</p>
                        <PillButton variant="outline" size="md" className="mt-4" onClick={fetchGenesisState}>
                            Retry
                        </PillButton>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-page text-ink-body">
            <main className="max-w-[1376px] mx-auto px-4 py-6 sm:px-8 sm:py-8 flex flex-col gap-6">
                {/* Header */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="m-0 text-[28px] font-semibold text-ink">Genesis state</h1>
                        <span className="text-ink-muted">Block 0: the accounts that existed when the chain was started</span>
                    </div>
                    <PillButton variant="outline" size="md" onClick={fetchGenesisState}>
                        Refresh
                    </PillButton>
                </div>

                {/* Your Wallet Status */}
                {cosmosAddress && (
                    <Card className={myWalletInGenesis ? "border-emerald-400/40" : "border-amber-400/40"}>
                        <CardHeader title="Your connected wallet" />
                        <div className="p-5 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-ink-muted">Address:</span>
                                <code className="text-ink font-mono text-[13px] bg-surface-page px-2 py-1 rounded-lg break-all">{cosmosAddress}</code>
                                <PillButton variant="ghost" size="sm" className="max-sm:h-11" onClick={() => copyToClipboard(cosmosAddress, "Address")}>
                                    Copy
                                </PillButton>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-ink-muted">Status:</span>
                                {myWalletInGenesis ? (
                                    <span className="text-emerald-400 font-semibold">In genesis (has funds)</span>
                                ) : (
                                    <span className="text-amber-400 font-semibold">Not in genesis (needs tokens)</span>
                                )}
                            </div>
                            {!myWalletInGenesis && (
                                <div className="mt-3 p-4 bg-amber-400/10 border border-amber-400/30 rounded-xl">
                                    <p className="text-amber-200 text-sm">
                                        <strong>Tip:</strong> Your wallet doesn't have any tokens. Import one of the test account mnemonics below to get
                                        started!
                                    </p>
                                </div>
                            )}
                        </div>
                    </Card>
                )}

                {/* Genesis Accounts */}
                <Card>
                    <CardHeader title={`Genesis accounts (${accounts.length})`} />
                    <div className="p-4 sm:p-5 space-y-3">
                        {accounts.map((account, index) => (
                            <div
                                key={account.address}
                                className={`bg-surface-raised rounded-xl p-4 sm:p-5 border ${
                                    isMyWallet(account.address) ? "border-emerald-400/50" : account.isValidator ? "border-brand/50" : "border-line"
                                }`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[15px] font-semibold text-ink">
                                                {account.isValidator ? "Validator" : `Account ${index + 1}`}
                                                {account.moniker && ` - ${account.moniker}`}
                                            </span>
                                            {isMyWallet(account.address) && (
                                                <span className="px-2.5 py-0.5 bg-emerald-400/15 text-emerald-300 text-xs font-semibold rounded-full">You</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <code className="text-[13px] text-ink-soft font-mono break-all">{account.address}</code>
                                            <PillButton
                                                variant="ghost"
                                                size="sm"
                                                className="max-sm:h-11 flex-shrink-0"
                                                onClick={() => copyToClipboard(account.address, "Address")}
                                            >
                                                Copy
                                            </PillButton>
                                        </div>
                                    </div>
                                </div>

                                {/* Balances */}
                                <div className="mt-3">
                                    <h4 className="text-xs uppercase tracking-[0.08em] text-ink-muted mb-2">Balances</h4>
                                    {hasElements(account.balances) ? (
                                        <div className="space-y-1">
                                            {account.balances.map(balance => (
                                                <div key={balance.denom} className="flex items-center gap-2">
                                                    <span className="text-ink font-semibold tabular-nums">{formatAmount(balance.amount, balance.denom)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-ink-muted text-sm">No balances</span>
                                    )}
                                </div>

                                {/* Account metadata */}
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                                    <span>Account #: {account.accountNumber}</span>
                                    <span>Sequence: {account.sequence}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Well-Known Test Accounts */}
                <Card>
                    <CardHeader title="Well-known test accounts" subtitle="From config.yml" />
                    <div className="p-4 sm:p-5 space-y-3">
                        <p className="text-ink-soft m-0">Import one of these mnemonics to get instant access to test tokens.</p>
                        {WELL_KNOWN_ACCOUNTS.map(wellKnown => {
                            const derivedAddress = derivedAddresses.get(wellKnown.name);

                            // Try to find this account in genesis using derived address
                            const genesisAccount = derivedAddress ? accounts.find(acc => acc.address === derivedAddress) : null;

                            const isMyWalletAccount = derivedAddress && cosmosAddress?.toLowerCase() === derivedAddress.toLowerCase();

                            return (
                                <div
                                    key={wellKnown.name}
                                    className={`bg-surface-raised rounded-xl p-4 border ${
                                        isMyWalletAccount ? "border-emerald-400/50" : genesisAccount ? "border-brand/40" : "border-line"
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h3 className="m-0 text-[15px] font-semibold text-ink capitalize">{wellKnown.name}</h3>
                                                {isMyWalletAccount && (
                                                    <span className="px-2.5 py-0.5 bg-emerald-400/15 text-emerald-300 text-xs font-semibold rounded-full">
                                                        You
                                                    </span>
                                                )}
                                                {genesisAccount ? (
                                                    <span className="px-2.5 py-0.5 bg-brand/20 text-brand-light text-xs font-semibold rounded-full">
                                                        In genesis
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-0.5 bg-amber-400/15 text-amber-300 text-xs font-semibold rounded-full">
                                                        Not in genesis
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-ink-muted">Test account from config.yml</p>

                                            {/* Show derived address */}
                                            {derivedAddress && (
                                                <div className="mt-2 flex items-start gap-2">
                                                    <span className="text-xs text-ink-muted pt-1 flex-shrink-0">Address:</span>
                                                    <code className="text-xs text-ink-soft font-mono bg-surface-page px-2 py-1 rounded-lg break-all flex-1">
                                                        {derivedAddress}
                                                    </code>
                                                    <PillButton
                                                        variant="ghost"
                                                        size="sm"
                                                        className="max-sm:h-11 flex-shrink-0"
                                                        onClick={() => copyToClipboard(derivedAddress, `${wellKnown.name} address`)}
                                                    >
                                                        Copy
                                                    </PillButton>
                                                </div>
                                            )}

                                            {/* Show balances if account is in genesis */}
                                            {genesisAccount && hasElements(genesisAccount.balances) && (
                                                <div className="mt-2">
                                                    <span className="text-xs text-ink-muted">Balances: </span>
                                                    {genesisAccount.balances.map((bal, idx) => (
                                                        <span key={bal.denom} className="text-xs text-emerald-400 font-semibold">
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
                                            <label className="text-xs text-ink-muted mb-1 block">Mnemonic (BIP39):</label>
                                            <div className="flex items-start gap-2">
                                                <code className="text-xs text-ink-soft font-mono bg-surface-page px-3 py-2 rounded-lg flex-1 break-all">
                                                    {wellKnown.mnemonic}
                                                </code>
                                                <PillButton
                                                    variant="outline"
                                                    size="sm"
                                                    className="max-sm:h-11 flex-shrink-0"
                                                    onClick={() => copyToClipboard(wellKnown.mnemonic, `${wellKnown.name} mnemonic`)}
                                                >
                                                    Copy
                                                </PillButton>
                                            </div>
                                        </div>

                                        <div className="mt-2 p-3 bg-brand/10 border border-brand/30 rounded-xl">
                                            <p className="text-xs text-ink-soft m-0">
                                                <strong className="text-ink">How to use:</strong> Copy the mnemonic above and import it into your Keplr wallet
                                                or Block52 wallet to access this test account.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>

                {/* Validators Info */}
                {hasElements(validators) && (
                    <Card>
                        <CardHeader title={`Validators (${validators.length})`} />
                        <div className="p-4 sm:p-5 space-y-3">
                            {validators.map(validator => (
                                <div key={validator.operator_address} className="bg-surface-raised border border-line rounded-xl p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="m-0 text-ink font-semibold">{validator.description?.moniker || "Unknown Validator"}</h3>
                                            <code className="text-xs text-ink-muted font-mono break-all">{validator.operator_address}</code>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-ink-muted">Status</div>
                                            <div
                                                className={`text-sm font-semibold ${
                                                    validator.status === "BOND_STATUS_BONDED" ? "text-emerald-400" : "text-amber-400"
                                                }`}
                                            >
                                                {validator.status === "BOND_STATUS_BONDED" ? "Bonded" : "Unbonded"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {/* Bridge State Export/Import Section */}
                <Card>
                    <CardHeader title="Bridge state export" subtitle="For chain reset" />
                    <div className="p-4 sm:p-5">
                        <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-4 mb-4">
                            <h3 className="m-0 text-[15px] font-semibold text-ink mb-2">Why export bridge state?</h3>
                            <ul className="list-disc list-inside text-sm text-ink-soft space-y-1">
                                <li>
                                    Withdrawals are <strong>real USDC</strong> transactions on Ethereum
                                </li>
                                <li>If you reset the Block52 chain, withdrawal records will be lost</li>
                                <li>But Ethereum still knows about those nonces - must preserve them!</li>
                                <li>Export before reset, then import into new genesis to maintain integrity</li>
                            </ul>
                        </div>

                        <div className="flex gap-4 mb-4">
                            <PillButton variant="primary" size="md" onClick={fetchBridgeState} disabled={loadingBridgeState}>
                                {loadingBridgeState ? "Loading..." : "Load current bridge state"}
                            </PillButton>
                        </div>

                        {bridgeState && (
                            <div className="space-y-4">
                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-px bg-line border border-line rounded-2xl overflow-hidden">
                                    <div className="bg-surface-card px-4 py-3">
                                        <div className="text-xs uppercase tracking-[0.08em] text-ink-muted">Withdrawal requests</div>
                                        <div className="text-2xl font-semibold text-ink tabular-nums">{bridgeState.withdrawal_requests?.length || 0}</div>
                                    </div>
                                    <div className="bg-surface-card px-4 py-3">
                                        <div className="text-xs uppercase tracking-[0.08em] text-ink-muted">Processed ETH txs</div>
                                        <div className="text-2xl font-semibold text-ink tabular-nums">{bridgeState.processed_eth_txs?.length || 0}</div>
                                    </div>
                                </div>

                                {/* Genesis JSON */}
                                <div>
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                        <h3 className="m-0 text-[15px] font-semibold text-ink">Genesis JSON (poker module state)</h3>
                                        <PillButton
                                            variant="outline"
                                            size="sm"
                                            className="max-sm:h-11"
                                            onClick={() => copyToClipboard(JSON.stringify(bridgeState, null, 2), "Bridge state")}
                                        >
                                            Copy JSON
                                        </PillButton>
                                    </div>
                                    <div className="bg-surface-page border border-line rounded-xl p-4 overflow-x-auto">
                                        <pre className="text-xs text-ink-body font-mono">{JSON.stringify(bridgeState, null, 2)}</pre>
                                    </div>
                                </div>

                                {/* Instructions */}
                                <div className="bg-surface-raised border border-line rounded-xl p-4">
                                    <h3 className="m-0 text-[15px] font-semibold text-ink mb-3">How to import into a new genesis</h3>
                                    <ol className="list-decimal list-inside text-sm text-ink-soft space-y-2">
                                        <li>
                                            <strong>Copy the JSON above</strong> (click "Copy JSON" button)
                                        </li>
                                        <li>
                                            <strong>Stop the chain</strong> (Ctrl+C in terminal)
                                        </li>
                                        <li>
                                            <strong>Reset testnet data:</strong>
                                            <code className="block bg-surface-page text-xs p-2 mt-1 rounded-lg font-mono break-all">
                                                ./run-local-testnet.sh → Option 7 (Clean & Reset)
                                            </code>
                                        </li>
                                        <li>
                                            <strong>Initialize new chain:</strong>
                                            <code className="block bg-surface-page text-xs p-2 mt-1 rounded-lg font-mono break-all">
                                                ./run-local-testnet.sh → Option 1 (Initialize)
                                            </code>
                                        </li>
                                        <li>
                                            <strong>Edit genesis.json before starting:</strong>
                                            <code className="block bg-surface-page text-xs p-2 mt-1 rounded-lg font-mono break-all">
                                                vi ~/.pokerchain-testnet/node1/config/genesis.json
                                            </code>
                                        </li>
                                        <li>
                                            <strong>Find the poker module section:</strong> Look for{" "}
                                            <code className="bg-surface-page px-1 rounded">"poker": &#123;</code>
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
                </Card>
            </main>
        </div>
    );
}
