import { FC, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toValoperAddress } from "@block52/poker-vm-sdk";
import { ChainOverview } from "../../hooks/nodes/useChainOverview";
import { useCreateValidator } from "../../hooks/nodes/useCreateValidator";
import { useCosmosWallet } from "../../hooks/wallet";
import { formatMicroAsUsdc } from "../../constants/currency";
import { faultTolerance, parseConsensusPubkey, parseMicroAmount, powerShareBps, wouldControlLiveness } from "../../utils/nodePortal";
import { hasContent } from "../../utils/guards";

const inputClass = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500";

const Field: FC<{ label: string; hint?: string; error?: string | null; children: React.ReactNode }> = ({ label, hint, error, children }) => (
    <label className="block mb-4">
        <span className="block text-sm text-gray-300 mb-1">{label}</span>
        {children}
        {hint && !error && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
        {error && <span className="block text-xs text-red-400 mt-1">{error}</span>}
    </label>
);

/**
 * Self-service bonding: MsgCreateValidator from the connected Block52 wallet.
 * The UI checks what the chain can't: that one validator never gets enough power
 * to halt the chain alone, and that the operator confirms the node is synced
 * with this exact consensus key.
 */
export const BecomeValidatorPanel: FC<{ overview: ChainOverview; onBonded: () => void }> = ({ overview, onBonded }) => {
    const { address, balance } = useCosmosWallet();
    const { createValidator, isSubmitting, error: submitError, txHash } = useCreateValidator();

    const [pubkeyInput, setPubkeyInput] = useState("");
    const [moniker, setMoniker] = useState("");
    const [website, setWebsite] = useState("");
    const [securityContact, setSecurityContact] = useState("");
    const [details, setDetails] = useState("");
    const [amountInput, setAmountInput] = useState(formatMicroAsUsdc(overview.minValidatorBond, 0));
    const [commissionRate, setCommissionRate] = useState("0.10");
    const [commissionMaxRate, setCommissionMaxRate] = useState("0.20");
    const [commissionMaxChangeRate, setCommissionMaxChangeRate] = useState("0.01");
    const [confirmedSynced, setConfirmedSynced] = useState(false);
    const [confirmedUpgrades, setConfirmedUpgrades] = useState(false);

    const denomLabel = overview.bondDenom.toUpperCase();
    const walletBalance = useMemo(() => {
        const coin = balance.find(b => b.denom === overview.bondDenom);
        return coin ? BigInt(coin.amount) : 0n;
    }, [balance, overview.bondDenom]);

    const existing = useMemo(() => {
        if (!hasContent(address)) return undefined;
        const valoper = toValoperAddress(address);
        return overview.validators.find(v => v.operatorAddress === valoper);
    }, [address, overview.validators]);

    const pubkey = parseConsensusPubkey(pubkeyInput);
    const amount = parseMicroAmount(amountInput);
    const powers = overview.validators.map(v => v.tokens);

    const amountError = !amount.ok
        ? amount.error
        : amount.value < overview.minValidatorBond
          ? `Minimum bond is ${formatMicroAsUsdc(overview.minValidatorBond)} ${denomLabel}`
          : amount.value > walletBalance
            ? `Your wallet has ${formatMicroAsUsdc(walletBalance)} ${denomLabel}`
            : wouldControlLiveness(powers, amount.value)
              ? "This bond would give one validator 1/3 or more of the voting power, enough to halt the chain on its own if it goes offline"
              : null;

    const canSubmit =
        hasContent(address) &&
        pubkey.ok &&
        amount.ok &&
        amountError === null &&
        moniker.trim().length > 0 &&
        confirmedSynced &&
        confirmedUpgrades &&
        !isSubmitting;

    const handleSubmit = async () => {
        if (!pubkey.ok || !amount.ok) return;
        const hash = await createValidator({
            consensusPubkeyBase64: pubkey.value,
            amount: amount.value,
            denom: overview.bondDenom,
            moniker,
            website,
            securityContact,
            details,
            commissionRate,
            commissionMaxRate,
            commissionMaxChangeRate,
            minSelfDelegation: 1n
        });
        if (hash) onBonded();
    };

    if (!hasContent(address)) {
        return (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-gray-300">
                Bonding is signed by your Block52 wallet, whose account becomes the validator&apos;s operator. <Link to="/wallet" className="text-blue-400">Create or import a wallet</Link> first.
            </div>
        );
    }

    if (existing) {
        return (
            <div className="bg-gray-800 border border-green-700 rounded-lg p-6">
                <h3 className="text-white font-semibold mb-2">You operate a validator: {existing.moniker}</h3>
                <p className="text-sm text-gray-300 font-mono break-all">{existing.operatorAddress}</p>
                <p className="text-sm text-gray-300 mt-2">
                    Bonded {formatMicroAsUsdc(existing.tokens)} {denomLabel}
                    {existing.jailed ? " · JAILED: your node missed too many blocks; bring it back and unjail it" : " · active"}
                </p>
            </div>
        );
    }

    const shareBps = amount.ok ? powerShareBps(powers, amount.value) : 0;
    const toleranceAfter = amount.ok ? faultTolerance([...powers, amount.value]) : faultTolerance(powers);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-white font-semibold mb-4">Bond a validator</h3>

                <Field
                    label="Consensus public key"
                    hint="On your node: pokerchaind comet show-validator. Paste the whole JSON or just the key."
                    error={pubkeyInput && !pubkey.ok ? pubkey.error : null}
                >
                    <textarea className={`${inputClass} font-mono h-20`} value={pubkeyInput} onChange={e => setPubkeyInput(e.target.value)} />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <Field label="Moniker (public name)">
                        <input className={inputClass} value={moniker} onChange={e => setMoniker(e.target.value)} maxLength={70} />
                    </Field>
                    <Field
                        label={`Self-bond (${denomLabel})`}
                        hint={`Minimum ${formatMicroAsUsdc(overview.minValidatorBond)}; wallet ${formatMicroAsUsdc(walletBalance)}`}
                        error={amountInput ? amountError : null}
                    >
                        <input className={inputClass} value={amountInput} onChange={e => setAmountInput(e.target.value)} inputMode="decimal" />
                    </Field>
                    <Field label="Website (optional)">
                        <input className={inputClass} value={website} onChange={e => setWebsite(e.target.value)} />
                    </Field>
                    <Field label="Security contact (optional)">
                        <input className={inputClass} value={securityContact} onChange={e => setSecurityContact(e.target.value)} />
                    </Field>
                </div>
                <Field label="Details (optional)">
                    <input className={inputClass} value={details} onChange={e => setDetails(e.target.value)} maxLength={280} />
                </Field>

                <div className="grid grid-cols-3 gap-x-4">
                    <Field label="Commission" hint="e.g. 0.10 = 10%">
                        <input className={inputClass} value={commissionRate} onChange={e => setCommissionRate(e.target.value)} />
                    </Field>
                    <Field label="Max commission" hint="Can never be raised">
                        <input className={inputClass} value={commissionMaxRate} onChange={e => setCommissionMaxRate(e.target.value)} />
                    </Field>
                    <Field label="Max daily change">
                        <input className={inputClass} value={commissionMaxChangeRate} onChange={e => setCommissionMaxChangeRate(e.target.value)} />
                    </Field>
                </div>

                <label className="flex items-start gap-2 text-sm text-gray-300 mb-2">
                    <input type="checkbox" className="mt-1" checked={confirmedSynced} onChange={e => setConfirmedSynced(e.target.checked)} />
                    My node is running, fully synced (catching_up = false) and uses exactly this consensus key. The key is on no other machine.
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-300 mb-5">
                    <input type="checkbox" className="mt-1" checked={confirmedUpgrades} onChange={e => setConfirmedUpgrades(e.target.checked)} />
                    I will upgrade pokerchaind with every release and follow coordinated halts. A validator on the wrong binary drops out of consensus.
                </label>

                <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
                >
                    {isSubmitting ? "Bonding…" : "Bond validator"}
                </button>

                {submitError && <p className="mt-3 text-sm text-red-400 break-words">{submitError}</p>}
                {txHash && (
                    <p className="mt-3 text-sm text-green-400 break-all">
                        Bonded. Transaction{" "}
                        <Link to={`/explorer/tx/${txHash}`} className="underline">
                            {txHash}
                        </Link>
                    </p>
                )}
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-sm text-gray-300 space-y-3 h-fit">
                <h3 className="text-white font-semibold">Before you bond</h3>
                <p>
                    <span className="text-white">Sync first.</span> From the moment the bond lands, your node must be signing blocks. A bonded validator that is
                    offline counts against the network.
                </p>
                <p>
                    <span className="text-white">Downtime is penalised.</span> Missing more than half of any {overview.slashing.signed_blocks_window}-block
                    window jails the validator and slashes part of the bond. Signing with the same key on two machines slashes more and bans the validator
                    permanently.
                </p>
                <p>
                    <span className="text-white">Unbonding takes {Math.round(Number(overview.unbondingTime.replace(/s$/, "")) / 86400)} days.</span>
                </p>
                <div className="border-t border-gray-700 pt-3">
                    <p className="text-gray-400">If you bond {amount.ok ? `${formatMicroAsUsdc(amount.value)} ${denomLabel}` : "this amount"}:</p>
                    <p className="text-white">{(shareBps / 100).toFixed(2)}% of voting power</p>
                    <p className={toleranceAfter === 0 ? "text-yellow-400" : "text-green-400"}>
                        Network survives {toleranceAfter} validator{toleranceAfter === 1 ? "" : "s"} offline
                    </p>
                </div>
            </div>
        </div>
    );
};
