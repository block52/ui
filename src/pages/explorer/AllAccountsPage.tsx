import { useState, useEffect, useMemo, useCallback, use } from "react";
import { useNavigate } from "react-router-dom";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { getCosmosClient } from "../../utils/cosmos/client";
import { useNetwork } from "../../context/NetworkContext";
import { microToUsdc } from "../../constants/currency";
import { AnimatedBackground } from "../../components/common/AnimatedBackground";
import { ExplorerHeader } from "../../components/explorer/ExplorerHeader";
import { Pagination } from "../../components/common";
import styles from "./AllAccountsPage.module.css";
import { useCosmosApi } from "../../context/CosmosApiContext";

const PAGE_SIZE = 20;

interface ValidatorInfo {
    operatorAddress: string;
    accountAddress: string;
    moniker: string;
    status: string;
}

interface AccountInfo {
    address: string;
    type: string;
    balances: { denom: string; amount: string }[];
    totalUsdcValue: number;
    isValidator?: boolean;
    validatorMoniker?: string;
    validatorStatus?: string;
}

export interface ValidatorsResponse {
    pagination: {
        next_key: string | null;
        total: string;
    };
    validators: any[];
}

export interface AccountsResponse {
    pagination: {
        next_key: string | null;
        total: string;
    };
    accounts: any[];
}

export interface AccountBalanceResponse {
    pagination: {
        next_key: string | null;
        total: string;
    };
    balances: { denom: string; amount: string }[];
}

export default function AllAccountsPage() {
    const navigate = useNavigate();
    const { currentNetwork } = useNetwork();

    const [accounts, setAccounts] = useState<AccountInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<"balance" | "address">("balance");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [searchFilter, setSearchFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const cosmosApi = useCosmosApi();

    // Convert validator operator address (b52valoper...) to account address (b521...)
    const valoperToAccount = (valoperAddr: string): string => {
        // Both addresses are derived from the same pubkey, just different prefixes
        // Use proper bech32 decode/encode to handle the checksum correctly
        try {
            const decoded = fromBech32(valoperAddr);
            // Get the base prefix (e.g., "b52" from "b52valoper")
            // The "1" in "b521..." is the bech32 separator, not part of the prefix
            const basePrefix = decoded.prefix.replace("valoper", "");
            // Re-encode with the account prefix
            const accountAddr = toBech32(basePrefix, decoded.data);
            return accountAddr;
        } catch (e) {
            console.error("Error converting valoper address:", e);
        }
        return "";
    };

    const fetchAllAccounts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const cosmosClient = getCosmosClient({
                rpc: currentNetwork.rpc,
                rest: currentNetwork.rest
            });

            if (!cosmosClient) {
                throw new Error("Block52 client not initialized");
            }

            // Fetch validators first to identify validator accounts
            const validatorMap = new Map<string, ValidatorInfo>();
            try {
                const validatorsResponse = (await cosmosApi.getValidators(100)) as ValidatorsResponse;
                if (validatorsResponse) {
                    const validators = validatorsResponse.validators || [];

                    validators.forEach((v: any) => {
                        const operatorAddress = v.operator_address;
                        const accountAddress = valoperToAccount(operatorAddress);
                        const moniker = v.description?.moniker || "Unknown";
                        // Status: BOND_STATUS_BONDED, BOND_STATUS_UNBONDING, BOND_STATUS_UNBONDED
                        const status = v.status?.replace("BOND_STATUS_", "") || "Unknown";

                        if (accountAddress) {
                            validatorMap.set(accountAddress, {
                                operatorAddress,
                                accountAddress,
                                moniker,
                                status
                            });
                        }
                    });
                }
            } catch (e) {
                console.error("Error fetching validators:", e);
            }

            // Fetch all accounts from the auth module
            const accountsResponse = (await cosmosApi.getAccounts()) as AccountsResponse;

            if (!accountsResponse) {
                throw new Error("Failed to fetch accounts");
            }

            const rawAccounts = accountsResponse.accounts || [];

            // Process accounts and fetch balances for each
            const accountsWithBalances: AccountInfo[] = await Promise.all(
                rawAccounts.map(async (account: any) => {
                    // Extract address based on account type
                    const address = account.address || account.base_account?.address || account.base_vesting_account?.base_account?.address || "";

                    // Determine account type
                    let type = "Unknown";
                    if (account["@type"]) {
                        const typePath = account["@type"];
                        type = typePath.split(".").pop() || "Unknown";
                        if (type === "BaseAccount") {
                            type = "B52 Account";
                        }
                    }

                    // Fetch balances for this account
                    let balances: { denom: string; amount: string }[] = [];
                    let totalUsdcValue = 0;

                    if (address) {
                        try {
                            const balanceResponse = (await cosmosApi.getBalanceByAddress(address)) as AccountBalanceResponse;
                            if (balanceResponse) {
                                balances = balanceResponse.balances || [];

                                // Calculate total USDC value (sum usdc balances)
                                balances.forEach(b => {
                                    if (b.denom === "usdc" || b.denom === "uusdc") {
                                        totalUsdcValue += microToUsdc(b.amount);
                                    }
                                });
                            }
                        } catch (e) {
                            console.error(`Failed to fetch balance for ${address}:`, e);
                        }
                    }

                    // Check if this account is a validator
                    const validatorInfo = validatorMap.get(address);

                    return {
                        address,
                        type,
                        balances,
                        totalUsdcValue,
                        isValidator: !!validatorInfo,
                        validatorMoniker: validatorInfo?.moniker,
                        validatorStatus: validatorInfo?.status
                    };
                })
            );

            // Filter out accounts without addresses
            const validAccounts = accountsWithBalances.filter(a => a.address);

            setAccounts(validAccounts);
        } catch (err: any) {
            let errorMessage = "Failed to fetch accounts";

            if (err.message?.includes("timeout")) {
                errorMessage = "Request timeout - network may be slow";
            } else if (err.code === "ERR_NETWORK" || err.message?.includes("ECONNREFUSED")) {
                errorMessage = `Cannot connect to ${currentNetwork.name}`;
            } else if (err.message) {
                errorMessage = err.message;
            }

            setError(errorMessage);
            console.error("Error fetching accounts:", err);
        } finally {
            setLoading(false);
        }
    }, [currentNetwork]);

    useEffect(() => {
        fetchAllAccounts();
    }, [fetchAllAccounts]);

    // Set page title
    useEffect(() => {
        document.title = "All Accounts - Block52 Explorer";

        return () => {
            document.title = "Block52 Chain";
        };
    }, []);

    // Sort and filter accounts
    const filteredAndSortedAccounts = useMemo(() => {
        let filtered = accounts;

        // Apply search filter
        if (searchFilter) {
            filtered = filtered.filter(
                a => a.address.toLowerCase().includes(searchFilter.toLowerCase()) || a.type.toLowerCase().includes(searchFilter.toLowerCase())
            );
        }

        // Sort
        return [...filtered].sort((a, b) => {
            if (sortBy === "balance") {
                return sortOrder === "desc" ? b.totalUsdcValue - a.totalUsdcValue : a.totalUsdcValue - b.totalUsdcValue;
            } else {
                return sortOrder === "desc" ? b.address.localeCompare(a.address) : a.address.localeCompare(b.address);
            }
        });
    }, [accounts, searchFilter, sortBy, sortOrder]);

    // Reset to page 1 when filter/sort changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchFilter, sortBy, sortOrder]);

    const pagedAccounts = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredAndSortedAccounts.slice(start, start + PAGE_SIZE);
    }, [filteredAndSortedAccounts, currentPage]);

    // Stats
    const stats = useMemo(() => {
        const totalAccounts = accounts.length;
        const totalUsdc = accounts.reduce((sum, a) => sum + a.totalUsdcValue, 0);
        const accountsWithBalance = accounts.filter(a => a.totalUsdcValue > 0).length;
        const validatorCount = accounts.filter(a => a.isValidator).length;

        return { totalAccounts, totalUsdc, accountsWithBalance, validatorCount };
    }, [accounts]);

    const formatBalance = (amount: string, denom: string) => {
        const value = microToUsdc(amount);
        // Map known denoms to display names
        const denomMap: Record<string, string> = {
            usdc: "USDC",
            uusdc: "USDC",
            stake: "STAKE",
            ustake: "STAKE"
        };
        const displayDenom = denomMap[denom.toLowerCase()] || denom.toUpperCase();
        return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${displayDenom}`;
    };

    const truncateAddress = (addr: string) => {
        if (addr.length <= 20) return addr;
        return `${addr.substring(0, 12)}...${addr.substring(addr.length - 8)}`;
    };

    const toggleSort = (field: "balance" | "address") => {
        if (sortBy === field) {
            setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortBy(field);
            setSortOrder("desc");
        }
    };

    return (
        <div className="min-h-screen p-8 relative">
            <AnimatedBackground />

            <div className="max-w-7xl mx-auto relative z-10">
                {/* Explorer Navigation Header */}
                <ExplorerHeader title="Block Explorer" />

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl ${styles.containerCard}`}>
                        <p className="text-gray-400 text-sm mb-1">Total Accounts</p>
                        <p className="text-3xl font-bold text-white">{stats.totalAccounts.toLocaleString()}</p>
                    </div>
                    <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl ${styles.containerCard}`}>
                        <p className="text-gray-400 text-sm mb-1">Accounts With Balance</p>
                        <p className="text-3xl font-bold text-white">{stats.accountsWithBalance.toLocaleString()}</p>
                    </div>
                    <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl ${styles.containerCard}`}>
                        <p className="text-gray-400 text-sm mb-1">Validators</p>
                        <p className="text-3xl font-bold text-purple-400">{stats.validatorCount.toLocaleString()}</p>
                    </div>
                    <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl ${styles.containerCard}`}>
                        <p className="text-gray-400 text-sm mb-1">Total USDC</p>
                        <p className={`text-3xl font-bold ${styles.brandText}`}>
                            ${stats.totalUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                {/* Search and Refresh */}
                <div className={`backdrop-blur-md p-4 rounded-xl shadow-2xl mb-6 ${styles.containerCard}`}>
                    <div className="flex flex-col md:flex-row gap-4">
                        <input
                            type="text"
                            value={searchFilter}
                            onChange={e => setSearchFilter(e.target.value)}
                            placeholder="Search by address or account type..."
                            className={`flex-1 px-4 py-2 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${styles.searchInput}`}
                        />
                        <button
                            onClick={fetchAllAccounts}
                            disabled={loading}
                            className={`px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50 ${styles.refreshButton}`}
                        >
                            {loading ? "Loading..." : "Refresh"}
                        </button>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.containerCard} ${styles.errorContainer}`}>
                        <p className="text-red-400 text-center">{error}</p>
                    </div>
                )}

                {/* Accounts Table */}
                {!error && (
                    <div className={`backdrop-blur-md rounded-xl shadow-2xl overflow-hidden ${styles.containerCard}`}>
                        {loading ? (
                            <div className="p-8 text-center">
                                <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4 ${styles.loadingSpinner}`}></div>
                                <p className="text-gray-400">Loading accounts...</p>
                            </div>
                        ) : filteredAndSortedAccounts.length === 0 ? (
                            <div className="p-8 text-center">
                                <p className="text-gray-400">No accounts found</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto" id="accounts-table-top">
                                <table className="w-full">
                                    <thead>
                                        <tr className={styles.tableHeaderRow}>
                                            <th className="px-6 py-4 text-left text-gray-400 font-semibold">#</th>
                                            <th
                                                className="px-6 py-4 text-left text-gray-400 font-semibold cursor-pointer hover:text-white transition-colors"
                                                onClick={() => toggleSort("address")}
                                            >
                                                Address {sortBy === "address" && (sortOrder === "asc" ? "↑" : "↓")}
                                            </th>
                                            <th className="px-6 py-4 text-left text-gray-400 font-semibold">Type</th>
                                            <th
                                                className="px-6 py-4 text-right text-gray-400 font-semibold cursor-pointer hover:text-white transition-colors"
                                                onClick={() => toggleSort("balance")}
                                            >
                                                USDC Balance {sortBy === "balance" && (sortOrder === "asc" ? "↑" : "↓")}
                                            </th>
                                            <th className="px-6 py-4 text-right text-gray-400 font-semibold">All Balances</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedAccounts.map((account, index) => (
                                            <tr
                                                key={account.address}
                                                className={`border-t cursor-pointer hover:bg-white/5 transition-colors ${styles.tableRowBorder}`}
                                                onClick={() => navigate(`/explorer/address/${account.address}`)}
                                            >
                                                <td className="px-6 py-4 text-gray-500">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`text-white font-mono text-sm hover:underline break-all ${styles.brandText}`}>
                                                            {account.address}
                                                        </span>
                                                        {account.isValidator && (
                                                            <div className="flex items-center gap-2">
                                                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                                                    Validator: {account.validatorMoniker}
                                                                </span>
                                                                <span
                                                                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                                        account.validatorStatus === "BONDED"
                                                                            ? "bg-green-500/20 text-green-400"
                                                                            : "bg-yellow-500/20 text-yellow-400"
                                                                    }`}
                                                                >
                                                                    {account.validatorStatus}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${styles.typePill}`}>{account.type}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-white font-bold">
                                                        $
                                                        {account.totalUsdcValue.toLocaleString(undefined, {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2
                                                        })}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {account.balances.length === 0 ? (
                                                        <span className="text-gray-500">-</span>
                                                    ) : (
                                                        <div className="flex flex-col items-end gap-1">
                                                            {account.balances.slice(0, 3).map((b, i) => (
                                                                <span key={i} className="text-gray-300 text-sm">
                                                                    {formatBalance(b.amount, b.denom)}
                                                                </span>
                                                            ))}
                                                            {account.balances.length > 3 && (
                                                                <span className="text-gray-500 text-xs">+{account.balances.length - 3} more</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {!loading && filteredAndSortedAccounts.length > 0 && (
                            <Pagination
                                currentPage={currentPage}
                                totalItems={filteredAndSortedAccounts.length}
                                pageSize={PAGE_SIZE}
                                onPageChange={page => {
                                    setCurrentPage(page);
                                    document.getElementById("accounts-table-top")?.scrollIntoView({ behavior: "smooth" });
                                }}
                            />
                        )}
                    </div>
                )}

                {/* Results count — small screens only (pagination shows it on larger screens) */}
                {!loading && !error && (
                    <div className="sm:hidden mt-4 text-center text-gray-400 text-sm">
                        Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredAndSortedAccounts.length)}–
                        {Math.min(currentPage * PAGE_SIZE, filteredAndSortedAccounts.length)} of {filteredAndSortedAccounts.length} accounts
                    </div>
                )}
            </div>
        </div>
    );
}
