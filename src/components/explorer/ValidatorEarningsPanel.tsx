import React, { useMemo } from "react";
import { ValidatorBond } from "@block52/poker-vm-sdk";
import { formatMicroAsUsdc } from "../../constants/currency";
import { truncateMiddle } from "../../utils/stringUtils";
import { isEmpty } from "../../utils/guards";
import { formatBps, shareOfTotalBps, sumBigInt } from "../../utils/nodePortal";
import { cssVars } from "../../utils/cssVars";
import { Card, CardHeader } from "../ui";

interface ValidatorEarningsPanelProps {
    bonds: ValidatorBond[];
    hasQuery: boolean;
    isLoading: boolean;
    className?: string;
}

const thClass = "px-4 py-3.5 first:pl-5 last:pr-5 text-left text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted";
const tdClass = "px-4 py-3.5 first:pl-5 last:pr-5 whitespace-nowrap";

// Bonded USDC is the weight the SNG protocol fee is split by. Accrued earnings are not shown:
// fees are paid and emitted per distribution, with no per-validator accumulator to read.
const ValidatorEarningsPanel: React.FC<ValidatorEarningsPanelProps> = ({ bonds, hasQuery, isLoading, className = "" }) => {
    // bondedUsdc is a Long in micro-USDC; toString is the lossless bridge to bigint.
    const amounts = useMemo(() => bonds.map(bond => BigInt(bond.bondedUsdc.toString())), [bonds]);
    const totalBonded = useMemo(() => sumBigInt(amounts), [amounts]);

    return (
        <Card className={className}>
            <CardHeader title="Validator earnings" />
            <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                    <thead>
                        <tr>
                            <th className={thClass}>Validator</th>
                            <th className={thClass}>Bonded USDC</th>
                            <th className={thClass}>Fee share</th>
                            <th className={thClass}>Fee earnings</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr className="border-t border-line">
                                <td className="px-5 py-4 text-ink-muted" colSpan={4}>
                                    Loading validator bonds...
                                </td>
                            </tr>
                        ) : !hasQuery || isEmpty(bonds) ? (
                            <tr className="border-t border-line">
                                <td className="px-5 py-4 text-ink-muted whitespace-normal" colSpan={4}>
                                    Validator bonded-USDC and earnings are not yet available from the chain. Coming soon.
                                </td>
                            </tr>
                        ) : (
                            bonds.map((bond, index) => {
                                const shareBps = shareOfTotalBps(amounts[index], totalBonded);
                                return (
                                    <tr key={bond.validator} className="border-t border-line hover:bg-surface-raised transition-colors">
                                        <td className={`${tdClass} font-mono text-[13px] text-ink-body`} title={bond.validator}>
                                            {truncateMiddle(bond.validator, 10, 8)}
                                        </td>
                                        <td className={`${tdClass} text-ink tabular-nums`}>${formatMicroAsUsdc(bond.bondedUsdc.toString(), 2)}</td>
                                        <td className={tdClass}>
                                            {shareBps === null ? (
                                                <span className="text-ink-muted">-</span>
                                            ) : (
                                                <div className="flex items-center gap-2.5">
                                                    <span className="inline-block w-[72px] h-1 rounded-sm bg-line-strong overflow-hidden" aria-hidden="true">
                                                        <span
                                                            className="block h-full bg-brand-light w-[var(--share)]"
                                                            style={cssVars({ "--share": `${shareBps / 100}%` })}
                                                        />
                                                    </span>
                                                    <span className="text-ink-soft tabular-nums">{formatBps(shareBps)}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className={`${tdClass} text-ink-muted`}>Coming soon</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export default ValidatorEarningsPanel;
