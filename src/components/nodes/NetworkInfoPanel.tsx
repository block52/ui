import { FC } from "react";
import { Link } from "react-router-dom";
import { ChainOverview } from "../../hooks/nodes/useChainOverview";
import { useGenesisInfo } from "../../hooks/nodes/useGenesisInfo";
import { GENESIS_PATH, GENESIS_SHA256 } from "../../constants/chainNetwork";
import { formatMicroAsUsdc } from "../../constants/currency";
import { faultTolerance } from "../../utils/nodePortal";
import { copyToClipboard } from "../playPage/Table/utils";

const Row: FC<{ label: string; value: string; mono?: boolean; copy?: boolean }> = ({ label, value, mono, copy }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2 border-b border-gray-700 last:border-0">
        <span className="text-sm text-gray-400">{label}</span>
        <span className={`text-sm text-white break-all sm:text-right ${mono ? "font-mono" : ""}`}>
            {value}
            {copy && (
                <button onClick={() => copyToClipboard(value, `${label} copied`)} className="ml-2 text-xs text-blue-400 hover:text-blue-300">
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
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h3 className="text-white font-semibold mb-3">Chain</h3>
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

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h3 className="text-white font-semibold mb-3">Genesis</h3>
                {genesisError && <p className="text-red-400 text-sm">{genesisError}</p>}
                {genesis && (
                    <>
                        <Row label="Genesis time" value={genesis.genesisTime} mono />
                        <Row label="Initial height" value={genesis.initialHeight} mono />
                        <Row label="SHA-256" value={GENESIS_SHA256} mono copy />
                        <div className="py-2 border-b border-gray-700">
                            {genesis.verified ? (
                                <span className="text-sm text-green-400">✓ The file below hashes to this value (checked in your browser)</span>
                            ) : (
                                <span className="text-sm text-red-400">
                                    ✗ Served file hashes to {genesis.sha256}. Do not use it; report this to the Block52 team.
                                </span>
                            )}
                        </div>
                        {genesis.genesisValidators.map(v => (
                            <Row key={v.validatorAddress} label={`Genesis validator: ${v.moniker}`} value={`${v.validatorAddress} (${v.selfBond})`} mono />
                        ))}
                        <a
                            href={GENESIS_PATH}
                            download="genesis.json"
                            className="mt-4 inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                        >
                            Download genesis.json
                        </a>
                    </>
                )}
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 lg:col-span-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                    <h3 className="text-white font-semibold">Bonded validators ({overview.validators.length})</h3>
                    <span className={`text-sm ${tolerance === 0 ? "text-yellow-400" : "text-green-400"}`}>
                        {tolerance === 0
                            ? "No fault tolerance: every validator must be online for blocks to commit"
                            : `Survives ${tolerance} validator${tolerance > 1 ? "s" : ""} offline`}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-gray-400 text-left">
                            <tr>
                                <th className="py-2 pr-4 font-medium">Moniker</th>
                                <th className="py-2 pr-4 font-medium">Operator</th>
                                <th className="py-2 pr-4 font-medium text-right">Bonded</th>
                                <th className="py-2 font-medium text-right">Commission</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {overview.validators.map(v => (
                                <tr key={v.operatorAddress}>
                                    <td className="py-2 pr-4 text-white">
                                        {v.moniker}
                                        {v.jailed && <span className="ml-2 text-xs text-red-400">jailed</span>}
                                    </td>
                                    <td className="py-2 pr-4 font-mono text-xs text-gray-300">
                                        <Link to={`/explorer/address/${v.operatorAddress}`} className="hover:text-blue-400">
                                            {v.operatorAddress}
                                        </Link>
                                    </td>
                                    <td className="py-2 pr-4 text-right text-white">
                                        {formatMicroAsUsdc(v.tokens)} {overview.bondDenom.toUpperCase()}
                                    </td>
                                    <td className="py-2 text-right text-gray-300">{pct(v.commissionRate)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
