import { useState, useEffect, useMemo, useCallback, use } from "react";
import { isNetworkError } from "../../apis/HTTPClient";
import { useNavigate } from "react-router-dom";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { getCosmosClient } from "../../utils/cosmos/client";
import { useNetwork } from "../../context/NetworkContext";
import { microToUsdc } from "../../constants/currency";
import { truncateMiddle } from "../../utils/stringUtils";
import { formatTimestampAbsolute, formatTimestampRelative } from "../../utils/formatUtils";
import { compareLastActive, latestTimestamp } from "../../utils/accountActivity";
import { AnimatedBackground } from "../../components/common/AnimatedBackground";
import { ExplorerHeader } from "../../components/explorer/ExplorerHeader";
import {
    ExplorerEmpty,
    ExplorerError,
    ExplorerLoading,
    ExplorerPanel,
    ExplorerReloadButton,
    ExplorerSearchInput
} from "../../components/explorer/ExplorerPanel";
import { isEmpty, hasElements } from "../../utils/guards";
import { Pagination } from "../../components/common";
import styles from "./AllAccountsPage.module.css";
import { useCosmosApi } from "../../context/CosmosApiContext";

const PAGE_SIZE = 20;

type SortField = "balance" | "address" | "lastActive";

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
    /** Timestamp of the account's most recent sent or received tx; null when it has none. */
    lastActive: string | null;
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

interface LatestTransactionResponse {
    tx_responses?: { timestamp: string }[];
}

export default function AllAccountsPage() {
    const navigate = useNavigate();
    const { currentNetwork } = useNetwork();

    const [accounts, setAccounts] = useState<AccountInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<SortField>("balance");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    // The box is a draft; the applied filter changes on Search/Enter (or when cleared).
    const [searchInput, setSearchInput] = useState("");
    const [searchFilter, setSearchFilter] = useState("");
    const onSearchChange = (value: string) => {
        setSearchInput(value);
        // Clearing the box shows every account again without another click.
        if (!value.trim()) setSearchFilter("");
    };
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

    // The most recent tx the account sent or received. Failures leave the column blank
    // rather than failing the whole table.
    const fetchLastActive = async (address: string): Promise<string | null> => {
        try {
            const [sent, received] = (await Promise.all([
                cosmosApi.getLatestTransaction(`message.sender='${address}'`),
                cosmosApi.getLatestTransaction(`transfer.recipient='${address}'`)
            ])) as LatestTransactionResponse[];
            return latestTimestamp([sent.tx_responses?.[0]?.timestamp, received.tx_responses?.[0]?.timestamp]);
        } catch (e) {
            console.error(`Failed to fetch last activity for ${address}:`, e);
            return null;
        }
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

                    const lastActive = address ? await fetchLastActive(address) : null;

                    // Check if this account is a validator
                    const validatorInfo = validatorMap.get(address);

                    return {
                        address,
                        type,
                        balances,
                        totalUsdcValue,
                        lastActive,
                        isValidator: !!validatorInfo,
                        validatorMoniker: validatorInfo?.moniker,
                        validatorStatus: validatorInfo?.status
                    };
                })
            );

            // Filter out accounts without addresses
            const validAccounts = accountsWithBalances.filter(a => a.address);

            setAccounts(validAccounts);
        } catch (err) {
            const message = err instanceof Error ? err.message : "";
            let errorMessage = "Failed to fetch accounts";

            if (message.includes("timeout")) {
                errorMessage = "Request timeout - network may be slow";
            } else if (isNetworkError(err) || message.includes("ECONNREFUSED")) {
                errorMessage = `Cannot connect to ${currentNetwork.name}`;
            } else if (message) {
                errorMessage = message;
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
            } else if (sortBy === "lastActive") {
                return compareLastActive(a.lastActive, b.lastActive, sortOrder);
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

    const truncateAddress = (addr: string) => (addr.length <= 20 ? addr : truncateMiddle(addr, 12, 8));

    const toggleSort = (field: SortField) => {
        if (sortBy === field) {
            setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortBy(field);
            setSortOrder("desc");
        }
    };

    return (
        <div className="min-h-screen p-4 sm:p-8 relative">
            <AnimatedBackground />

            <div className="max-w-5xl mx-auto relative z-10">
                {/* Explorer Navigation Header */}
                <ExplorerHeader title="Block Explorer" />

                <ExplorerSearchInput
                    value={searchInput}
                    onChange={onSearchChange}
                    placeholder="Search by address or account type"
                    onSubmit={() => setSearchFilter(searchInput.trim())}
                    busy={loading}
                />

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4">
                    <div className={`backdrop-blur-md px-3 py-2 sm:px-4 sm:py-3 rounded-xl ${styles.containerCard}`}>
                        <p className="text-gray-400 text-xs sm:text-sm">Total Accounts</p>
                        <p className="text-lg sm:text-2xl font-bold text-white">{stats.totalAccounts.toLocaleString()}</p>
                    </div>
                    <div className={`backdrop-blur-md px-3 py-2 sm:px-4 sm:py-3 rounded-xl ${styles.containerCard}`}>
                        <p className="text-gray-400 text-xs sm:text-sm">Accounts With Balance</p>
                        <p className="text-lg sm:text-2xl font-bold text-white">{stats.accountsWithBalance.toLocaleString()}</p>
                    </div>
                    <div className={`backdrop-blur-md px-3 py-2 sm:px-4 sm:py-3 rounded-xl ${styles.containerCard}`}>
                        <p className="text-gray-400 text-xs sm:text-sm">Validators</p>
                        <p className="text-lg sm:text-2xl font-bold text-purple-400">{stats.validatorCount.toLocaleString()}</p>
                    </div>
                    <div className={`backdrop-blur-md px-3 py-2 sm:px-4 sm:py-3 rounded-xl ${styles.containerCard}`}>
                        <p className="text-gray-400 text-xs sm:text-sm">Total USDC</p>
                        <p className={`text-lg sm:text-2xl font-bold ${styles.brandText}`}>
                            ${stats.totalUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                {/* Accounts */}
                <ExplorerPanel
                    header={`Accounts${!loading && !error && hasElements(filteredAndSortedAccounts) ? ` · ${filteredAndSortedAccounts.length.toLocaleString()}` : ""}`}
                    action={<ExplorerReloadButton onClick={fetchAllAccounts} busy={loading} />}
                >
                    {loading ? (
                        <ExplorerLoading label="Loading accounts…" />
                    ) : error ? (
                        <ExplorerError>{error}</ExplorerError>
                    ) : isEmpty(filteredAndSortedAccounts) ? (
                        <ExplorerEmpty>{searchFilter ? "No accounts match that search." : "No accounts yet."}</ExplorerEmpty>
                    ) : (
                        <div className="overflow-x-auto" id="accounts-table-top">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className={styles.tableHeaderRow}>
                                        <th className="hidden sm:table-cell px-4 py-2 text-left text-gray-400 font-semibold whitespace-nowrap">#</th>
                                        <th
                                            className="px-3 sm:px-4 py-2 text-left text-gray-400 font-semibold whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                                            onClick={() => toggleSort("address")}
                                        >
                                            Address {sortBy === "address" && (sortOrder === "asc" ? "↑" : "↓")}
                                        </th>
                                        <th className="hidden md:table-cell px-4 py-2 text-left text-gray-400 font-semibold whitespace-nowrap">Type</th>
                                        <th
                                            className="px-3 sm:px-4 py-2 text-right text-gray-400 font-semibold whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                                            onClick={() => toggleSort("balance")}
                                        >
                                            USDC Balance {sortBy === "balance" && (sortOrder === "asc" ? "↑" : "↓")}
                                        </th>
                                        <th
                                            className="hidden sm:table-cell px-4 py-2 text-left text-gray-400 font-semibold whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                                            onClick={() => toggleSort("lastActive")}
                                        >
                                            Last Active {sortBy === "lastActive" && (sortOrder === "asc" ? "↑" : "↓")}
                                        </th>
                                        <th className="hidden md:table-cell px-4 py-2 text-right text-gray-400 font-semibold whitespace-nowrap">
                                            All Balances
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedAccounts.map((account, index) => (
                                        <tr
                                            key={account.address}
                                            className={`border-t cursor-pointer hover:bg-white/5 transition-colors ${styles.tableRowBorder}`}
                                            onClick={() => navigate(`/explorer/address/${account.address}`)}
                                        >
                                            <td className="hidden sm:table-cell px-4 py-2 text-gray-500">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                                            <td className="px-3 sm:px-4 py-2">
                                                <div className="flex flex-col gap-1">
                                                    <span
                                                        className={`font-mono text-xs sm:text-sm hover:underline ${styles.brandText}`}
                                                        title={account.address}
                                                    >
                                                        {truncateAddress(account.address)}
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
                                            <td className="hidden md:table-cell px-4 py-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles.typePill}`}>{account.type}</span>
                                            </td>
                                            <td className="px-3 sm:px-4 py-2 text-right whitespace-nowrap">
                                                <span className="text-white font-semibold">
                                                    $
                                                    {account.totalUsdcValue.toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    })}
                                                </span>
                                            </td>
                                            <td className="hidden sm:table-cell px-4 py-2 whitespace-nowrap">
                                                {account.lastActive ? (
                                                    <span className="text-gray-300" title={formatTimestampAbsolute(account.lastActive)}>
                                                        {formatTimestampRelative(account.lastActive)}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500">-</span>
                                                )}
                                            </td>
                                            <td className="hidden md:table-cell px-4 py-2 text-right">
                                                {isEmpty(account.balances) ? (
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
                    {!loading && hasElements(filteredAndSortedAccounts) && (
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
                </ExplorerPanel>

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
