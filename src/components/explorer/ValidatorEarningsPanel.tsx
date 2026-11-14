import React from "react";
import { formatMicroAsUsdc } from "../../constants/currency";
import { truncateMiddle } from "../../utils/stringUtils";
import { isEmpty } from "../../utils/guards";
import type { ValidatorBond } from "../../utils/validatorBonds";

interface ValidatorEarningsPanelProps {
    /** Bonded-USDC weights per validator (poker-vm#2592). */
    bonds: ValidatorBond[];
    /**
     * Whether bonded-USDC data has been fetched (from the standard Cosmos staking
     * endpoint). When false (no node reachable) we show an empty state rather than
     * fabricating numbers (Commandment #7).
     */
    hasQuery: boolean;
    isLoading: boolean;
}

/**
 * ValidatorEarningsPanel — shows each validator's bonded USDC (the weight the SNG
 * protocol fee is split by).
 *
 * Bonded USDC drives the split at join: share_i = protocolCut * bondedUsdc_i / Σ
 * bondedUsdc (poker-vm#2592), sourced from the validator's staking `tokens` (bond
 * denom is USDC). Accrued fee earnings over time are intentionally NOT shown:
 * protocol fees are paid-and-emitted per distribution with no per-validator
 * accumulator state, so a running total would need new state or event indexing.
 */
const ValidatorEarningsPanel: React.FC<ValidatorEarningsPanelProps> = ({ bonds, hasQuery, isLoading }) => {
    return (
        <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">Validator Earnings</h2>
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-900">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Validator</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Bonded USDC (split weight)</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Protocol-Fee Earnings</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {isLoading ? (
                                <tr>
                                    <td className="px-6 py-4 text-gray-400 text-sm" colSpan={3}>
                                        Loading validator bonds...
                                    </td>
                                </tr>
                            ) : !hasQuery || isEmpty(bonds) ? (
                                <tr>
                                    <td className="px-6 py-4 text-gray-400 text-sm" colSpan={3}>
                                        Validator bonded-USDC and earnings are not yet available from the chain.
                                        <span className="ml-1 text-purple-300">Coming soon.</span>
                                    </td>
                                </tr>
                            ) : (
                                bonds.map(bond => (
                                    <tr key={bond.validator} className="hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-white font-mono text-sm">{truncateMiddle(bond.validator, 10, 8)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {/* bondedUsdc is micro-USDC (6dp) as a string. */}
                                            <span className="text-white font-mono">${formatMicroAsUsdc(bond.bondedUsdc, 2)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {/* No per-validator earnings query exists yet — do NOT fabricate a value. */}
                                            <span className="text-purple-300 text-sm">Coming soon</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ValidatorEarningsPanel;
