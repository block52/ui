import React from "react";
import { ValidatorBond } from "@block52/poker-vm-sdk";
import { formatMicroAsUsdc } from "../../constants/currency";
import { truncateMiddle } from "../../utils/stringUtils";
import { isEmpty } from "../../utils/guards";

interface ValidatorEarningsPanelProps {
    /** Bonded-USDC weights per validator (SDK single source, poker-vm#2592). */
    bonds: ValidatorBond[];
    /**
     * Whether a real backend query backs `bonds`. When false, the state exists on
     * chain but is not yet queryable (no ValidatorBonds REST endpoint), so we show
     * a "coming soon" placeholder instead of fabricating numbers (Commandment #7).
     */
    hasQuery: boolean;
    isLoading: boolean;
}

/**
 * ValidatorEarningsPanel — shows each validator's bonded USDC (the weight the SNG
 * protocol fee is split by) and their accrued protocol-fee earnings.
 *
 * Bonded USDC drives the split at join: share_i = protocolCut * bondedUsdc_i / Σ
 * bondedUsdc (poker-vm#2592). Earnings ("coming soon") await a backend query — the
 * poker module accrues fees per validator but does not yet expose a read endpoint,
 * so we omit a number rather than invent one.
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
                                            {/* bondedUsdc is a Long in micro-USDC (6dp); toString feeds the shared formatter. */}
                                            <span className="text-white font-mono">${formatMicroAsUsdc(bond.bondedUsdc.toString(), 2)}</span>
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
