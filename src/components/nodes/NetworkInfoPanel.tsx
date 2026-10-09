import { FC } from "react";
import { Link } from "react-router-dom";
import { ChainOverview } from "../../hooks/nodes/useChainOverview";
import { useGenesisInfo } from "../../hooks/nodes/useGenesisInfo";
import { GENESIS_PATH, GENESIS_SHA256 } from "../../constants/chainNetwork";
import { formatMicroAsUsdc } from "../../constants/currency";
import { faultTolerance } from "../../utils/nodePortal";
import { copyToClipboard } from "../playPage/Table/utils";
import { Card, CardHeader, pillClass } from "../ui";

const Row: FC<{ label: string; value: string; mono?: boolean; copy?: boolean }> = ({ label, value, mono, copy }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2.5 border-b border-line last:border-0">
        <span className="text-sm text-ink-muted">{label}</span>
        <span className={`text-sm text-ink break-all sm:text-right ${mono ? "font-mono" : ""}`}>
            {value}
            {copy && (
                <button
                    onClick={() => copyToClipboard(value, `${label} copied`)}
                    className="ml-2 px-1 min-h-[44px] sm:min-h-0 text-xs text-brand-light hover:text-ink"
                >
                    copy
                </button>
            )}
        </span>
    </div>
);

const seconds = (s: string) => Number(s.replace(/s$/, ""));
const pct = (dec: string) => `${(Number(dec) * 100).toFixed(2).replace(/\.00$/, "")}%`;

/** Chain + genesis facts and the live validator set, with the network's fault tolerance. */
export const NetworkInfoPanel: FC<{ overview: ChainOverview }> = ({ overview }) => {
    const { genesis, error: genesisError } = useGenesisInfo();
    const powers = overview.validators.map(v => v.tokens);
    const tolerance = faultTolerance(powers);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader title="Chain" level="h3" />
                <div className="px-5 py-2">
                    <Row label="Chain ID" value={overview.chainId} mono copy />
                    <Row label="Latest height" value={overview.latestHeight.toLocaleString()} mono />
                    <Row label="pokerchaind version" value={overview.appVersion} mono />
                    <Row label="CometBFT version" value={overview.cometVersion} mono />
                    <Row label="Bond denom" value={overview.bondDenom} mono />
                    <Row label="Minimum validator bond" value={`${formatMicroAsUsdc(overview.minValidatorBond)} ${overview.bondDenom.toUpperCase()}`} />
                    <Row label="Unbonding time" value={`${Math.round(seconds(overview.unbondingTime) / 86400)} days`} />
                    <Row
                        label="Downtime rule"
                        value={`jailed if < ${pct(overview.slashing.min_signed_per_window)} of ${overview.slashing.signed_blocks_window} blocks signed (${Math.round(
                            seconds(overview.slashing.downtime_jail_duration) / 60
                        )} min, ${pct(overview.slashing.slash_fraction_downtime)} slash)`}
                    />
                    <Row label="Double-sign slash" value={`${pct(overview.slashing.slash_fraction_double_sign)} + permanent tombstone`} />
                </div>
            </Card>

            <Card>
                <CardHeader title="Genesis" level="h3" />
                <div className="px-5 py-2">
                    {genesisError && <p className="text-red-400 text-sm">{genesisError}</p>}
                    {genesis && (
                        <>
                            <Row label="Genesis time" value={genesis.genesisTime} mono />
                            <Row label="Initial height" value={genesis.initialHeight} mono />
                            <Row label="SHA-256" value={GENESIS_SHA256} mono copy />
                            <div className="py-2.5 border-b border-line">
                                {genesis.verified ? (
                                    <span className="text-sm text-emerald-400">✓ The file below hashes to this value (checked in your browser)</span>
                                ) : (
                                    <span className="text-sm text-red-400">
                                        ✗ Served file hashes to {genesis.sha256}. Do not use it; report this to the Block52 team.
                                    </span>
                                )}
                            </div>
                            {genesis.genesisValidators.map(v => (
                                <Row key={v.validatorAddress} label={`Genesis validator: ${v.moniker}`} value={`${v.validatorAddress} (${v.selfBond})`} mono />
                            ))}
                            <a href={GENESIS_PATH} download="genesis.json" className={pillClass("primary", "md", "mt-4 mb-3")}>
                                Download genesis.json
                            </a>
                        </>
                    )}
                </div>
            </Card>

            <Card className="lg:col-span-2">
                <CardHeader
                    title={`Bonded validators (${overview.validators.length})`}
                    level="h3"
                    actions={
                        <span className={`text-sm ${tolerance === 0 ? "text-amber-400" : "text-emerald-400"}`}>
                            {tolerance === 0
                                ? "No fault tolerance: every validator must be online for blocks to commit"
                                : `Survives ${tolerance} validator${tolerance > 1 ? "s" : ""} offline`}
                        </span>
                    }
                />
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm border-collapse">
                        <thead className="text-left text-xs uppercase tracking-[0.1em] text-ink-muted">
                            <tr>
                                <th className="py-3.5 pl-5 pr-4 font-semibold">Moniker</th>
                                <th className="py-3.5 pr-4 font-semibold">Operator</th>
                                <th className="py-3.5 pr-4 font-semibold text-right">Bonded</th>
                                <th className="py-3.5 pr-5 font-semibold text-right">Commission</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overview.validators.map(v => (
                                <tr key={v.operatorAddress} className="border-t border-line hover:bg-surface-raised transition-colors">
                                    <td className="py-3 pl-5 pr-4 text-ink">
                                        {v.moniker}
                                        {v.jailed && <span className="ml-2 text-xs text-red-400">jailed</span>}
                                    </td>
                                    <td className="py-3 pr-4 font-mono text-xs text-ink-soft">
                                        <Link to={`/explorer/address/${v.operatorAddress}`} className="text-ink-soft hover:text-brand-light">
                                            {v.operatorAddress}
                                        </Link>
                                    </td>
                                    <td className="py-3 pr-4 text-right text-ink tabular-nums whitespace-nowrap">
                                        {formatMicroAsUsdc(v.tokens)} {overview.bondDenom.toUpperCase()}
                                    </td>
                                    <td className="py-3 pr-5 text-right text-ink-soft tabular-nums">{pct(v.commissionRate)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
