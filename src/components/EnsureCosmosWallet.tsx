import { useEffect } from "react";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import {
    getCosmosMnemonic,
    setCosmosMnemonic,
    setCosmosAddress
} from "../utils/cosmos/storage";

/**
 * On first mount, if the browser has no Cosmos mnemonic stored, generate
 * a new one and persist it. block52/ui#377 — new users get a usable
 * wallet without an explicit onboarding step.
 *
 * Renders nothing. Non-blocking: the rest of the app paints immediately;
 * useCosmosWallet picks up the new mnemonic via its existing
 * localStorage read on next mount or re-mount.
 */
export const EnsureCosmosWallet: React.FC = () => {
    useEffect(() => {
        if (getCosmosMnemonic()) return;

        let cancelled = false;
        (async () => {
            try {
                const wallet = await DirectSecp256k1HdWallet.generate(24, { prefix: "b52" });
                if (cancelled) return;
                // Re-check after the await — another mount could have
                // raced ahead and written one. localStorage is the
                // arbitrator; if there's already a mnemonic, drop ours.
                if (getCosmosMnemonic()) return;

                const [account] = await wallet.getAccounts();
                setCosmosMnemonic(wallet.mnemonic);
                setCosmosAddress(account.address);
            } catch (err) {
                console.error("Failed to auto-generate Cosmos wallet:", err);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    return null;
};

export default EnsureCosmosWallet;
