import { useState, useEffect, useMemo, useCallback } from "react";
import { isNetworkError } from "../../apis/HTTPClient";
import { useNavigate } from "react-router-dom";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { getCosmosClient } from "../../utils/cosmos/client";
import { useNetwork } from "../../context/NetworkContext";
import { microToUsdc } from "../../constants/currency";
import { truncateMiddle } from "../../utils/stringUtils";
import {
    ExplorerEmpty,
    ExplorerError,
    ExplorerLoading,
    ExplorerPage,
    ExplorerPanel,
    ExplorerReloadButton,
    ExplorerSearchInput,
    explorerRowClass,
    explorerThClass
} from "../../components/explorer/ExplorerPanel";
import { StatStrip } from "../../components/ui";
import { isEmpty, hasElements } from "../../utils/guards";
import { Pagination } from "../../components/common";
import { useCosmosApi } from "../../context/CosmosApiContext";
import { accountAddressOf, accountTypeLabel, parseAccountBalanceResponse, parseAccountsResponse, parseValidatorsResponse } from "../../utils/typeConversions";
import { Coin } from "./types";


const PAGE_SIZE = 20;

interface AccountInfo {
    address: string;
    type: string;
    balances: Coin[];
    totalUsdcValue: number;
    isValidator: boolean;
    validatorMoniker?: string;
    validatorStatus?: string;
}

type SortField = "balance" | "address";

const DENOM_NAMES: Record<string, string> = {
    usdc: "USDC",
    uusdc: "USDC",
    stake: "STAKE",
    ustake: "STAKE"
};

/** Validators and their accounts share a key and differ only in bech32 prefix (b52valoper... vs b521...). */
const valoperToAccount = (valoperAddr: string): string | null => {
    try {
        const decoded = fromBech32(valoperAddr);
        return toBech32(decoded.prefix.replace("valoper", ""), decoded.data);
    } catch (e) {
        console.error("Error converting valoper address:", e);
        return null;
    }
};

const formatBalance = (amount: string, denom: string) => {
    const displayDenom = DENOM_NAMES[denom.toLowerCase()] ?? denom.toUpperCase();
    return `${microToUsdc(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${displayDenom}`;
};

const sortButtonClass =
    "inline-flex items-center gap-1 min-h-9 w-full uppercase tracking-[0.1em] font-semibold hover:text-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-light";

const truncateAddress = (addr: string) => (addr.length <= 20 ? addr : truncateMiddle(addr, 12, 8));

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

            const validatorMap = new Map<string, { moniker: string; status: string }>();
            try {
                const { validators } = parseValidatorsResponse(await cosmosApi.getValidators(100));
                validators.forEach(v => {
                    const accountAddress = valoperToAccount(v.operator_address);
                    if (accountAddress) {
                        // BOND_STATUS_BONDED, BOND_STATUS_UNBONDING or BOND_STATUS_UNBONDED
                        validatorMap.set(accountAddress, { moniker: v.description.moniker, status: v.status.replace("BOND_STATUS_", "") });
                    }
                });
            } catch (e) {
                console.error("Error fetching validators:", e);
            }

            const { accounts: rawAccounts } = parseAccountsResponse(await cosmosApi.getAccounts());

            const accountsWithBalances = await Promise.all(
                rawAccounts.map(async (account): Promise<AccountInfo | null> => {
                    const address = accountAddressOf(account);
                    if (address === null) return null;

                    let balances: Coin[] = [];
                    let totalUsdcValue = 0;
                    try {
                        balances = parseAccountBalanceResponse(await cosmosApi.getBalanceByAddress(address)).balances;
                        balances.forEach(b => {
                            if (b.denom === "usdc" || b.denom === "uusdc") {
                                totalUsdcValue += microToUsdc(b.amount);
                            }
                        });
                    } catch (e) {
                        console.error(`Failed to fetch balance for ${address}:`, e);
                    }

                    const validatorInfo = validatorMap.get(address);
                    return {
                        address,
                        type: accountTypeLabel(account["@type"]),
                        balances,
                        totalUsdcValue,
                        isValidator: validatorInfo !== undefined,
                        validatorMoniker: validatorInfo?.moniker,
                        validatorStatus: validatorInfo?.status
                    };
                })
            );

            setAccounts(accountsWithBalances.filter((a): a is AccountInfo => a !== null));
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
    }, [currentNetwork, cosmosApi]);

    useEffect(() => {
        fetchAllAccounts();
    }, [fetchAllAccounts]);

    useEffect(() => {
        document.title = "All Accounts - Block52 Explorer";

        return () => {
            document.title = "Block52 Chain";
        };
    }, []);

    const filteredAndSortedAccounts = useMemo(() => {
        let filtered = accounts;

        if (searchFilter) {
            filtered = filtered.filter(
                a => a.address.toLowerCase().includes(searchFilter.toLowerCase()) || a.type.toLowerCase().includes(searchFilter.toLowerCase())
            );
        }

        return [...filtered].sort((a, b) => {
            if (sortBy === "balance") {
                return sortOrder === "desc" ? b.totalUsdcValue - a.totalUsdcValue : a.totalUsdcValue - b.totalUsdcValue;
            } else {
                return sortOrder === "desc" ? b.address.localeCompare(a.address) : a.address.localeCompare(b.address);
            }
        });
    }, [accounts, searchFilter, sortBy, sortOrder]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchFilter, sortBy, sortOrder]);

    const pagedAccounts = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredAndSortedAccounts.slice(start, start + PAGE_SIZE);
    }, [filteredAndSortedAccounts, currentPage]);

    const stats = useMemo(() => {
        const totalAccounts = accounts.length;
        const totalUsdc = accounts.reduce((sum, a) => sum + a.totalUsdcValue, 0);
        const accountsWithBalance = accounts.filter(a => a.totalUsdcValue > 0).length;
        const validatorCount = accounts.filter(a => a.isValidator).length;

        return { totalAccounts, totalUsdc, accountsWithBalance, validatorCount };
    }, [accounts]);

    const toggleSort = (field: SortField) => {
        if (sortBy === field) {
            setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortBy(field);
            setSortOrder("desc");
        }
    };

    const ariaSort = (field: SortField) => (sortBy !== field ? "none" : sortOrder === "asc" ? "ascending" : "descending");

    return (
        <ExplorerPage>

                <ExplorerSearchInput
                    value={searchInput}
                    onChange={onSearchChange}
                    placeholder="Search by address or account type"
                    onSubmit={() => setSearchFilter(searchInput.trim())}
                    busy={loading}
                />

                <div className="mb-6">
                    <StatStrip
                        items={[
                            { label: "Total accounts", value: stats.totalAccounts.toLocaleString() },
                            { label: "With balance", value: stats.accountsWithBalance.toLocaleString() },
                            { label: "Validators", value: stats.validatorCount.toLocaleString() },
                            {
                                label: "Total USDC",
                                value: `$${stats.totalUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            }
                        ]}
                    />
                </div>

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
                                    <tr>
                                        <th className={`${explorerThClass} hidden sm:table-cell`}>#</th>
                                        <th className={explorerThClass} aria-sort={ariaSort("address")}>
                                            <button type="button" onClick={() => toggleSort("address")} className={sortButtonClass}>
                                                Address {sortBy === "address" && (sortOrder === "asc" ? "↑" : "↓")}
                                            </button>
                                        </th>
                                        <th className={`${explorerThClass} hidden md:table-cell`}>Type</th>
                                        <th className={`${explorerThClass} text-right`} aria-sort={ariaSort("balance")}>
                                            <button type="button" onClick={() => toggleSort("balance")} className={`${sortButtonClass} justify-end`}>
                                                USDC Balance {sortBy === "balance" && (sortOrder === "asc" ? "↑" : "↓")}
                                            </button>
                                        </th>
                                        <th className={`${explorerThClass} hidden md:table-cell text-right`}>
                                            All Balances
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedAccounts.map((account, index) => (
                                        <tr
                                            key={account.address}
                                            className={`${explorerRowClass} cursor-pointer`}
                                            onClick={() => navigate(`/explorer/address/${account.address}`)}
                                        >
                                            <td className="hidden sm:table-cell px-4 sm:px-5 py-3 text-ink-muted tabular-nums">{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                                            <td className="px-4 sm:px-5 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <span
                                                        className="font-mono text-xs sm:text-sm text-brand-light hover:underline"
                                                        title={account.address}
                                                    >
                                                        {truncateAddress(account.address)}
                                                    </span>
                                                    {account.isValidator && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand/15 text-brand-light border border-brand/30">
                                                                Validator: {account.validatorMoniker}
                                                            </span>
                                                            <span
                                                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                                                    account.validatorStatus === "BONDED"
                                                                        ? "bg-emerald-400/15 text-emerald-400"
                                                                        : "bg-amber-400/15 text-amber-300"
                                                                }`}
                                                            >
                                                                {account.validatorStatus}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="hidden md:table-cell px-4 sm:px-5 py-3">
                                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface-raised text-ink-soft">{account.type}</span>
                                            </td>
                                            <td className="px-4 sm:px-5 py-3 text-right whitespace-nowrap">
                                                <span className="text-ink font-semibold">
                                                    $
                                                    {account.totalUsdcValue.toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2
                                                    })}
                                                </span>
                                            </td>
                                            <td className="hidden md:table-cell px-4 sm:px-5 py-3 text-right">
                                                {isEmpty(account.balances) ? (
                                                    <span className="text-ink-muted">-</span>
                                                ) : (
                                                    <div className="flex flex-col items-end gap-1">
                                                        {account.balances.slice(0, 3).map((b, i) => (
                                                            <span key={i} className="text-ink-soft text-sm">
                                                                {formatBalance(b.amount, b.denom)}
                                                            </span>
                                                        ))}
                                                        {account.balances.length > 3 && (
                                                            <span className="text-ink-muted text-xs">+{account.balances.length - 3} more</span>
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

                {!loading && !error && (
                    <div className="sm:hidden mt-4 text-center text-ink-muted text-sm">
                        Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredAndSortedAccounts.length)}–
                        {Math.min(currentPage * PAGE_SIZE, filteredAndSortedAccounts.length)} of {filteredAndSortedAccounts.length} accounts
                    </div>
                )}
        </ExplorerPage>
    );
}
