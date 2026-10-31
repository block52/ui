import { useEffect, useMemo, useState } from "react";
import { useNetwork } from "../../context/NetworkContext";
import { fetchTableNameAvailable, normalizeTableName, tableNameTakenMessage, validateTableName } from "../../utils/tableName";
import { hasContent, isBlank } from "../../utils/guards";

/** How long typing must pause before the name is checked against the chain. */
export const NAME_CHECK_DEBOUNCE_MS = 400;

/**
 * The error to show under a table-name field, or null (ui#878): the format rules
 * first (validateTableName), then whether the name is already taken on chain,
 * checked as the player types (debounced) with the chain's `name_available`
 * query. Both create forms already disable Create while this is non-null, so a
 * taken name is caught before anything is sent. If the check can't be made the
 * name is not blocked; the chain still refuses a taken name at create time.
 */
export function useTableNameError(rawName: string): string | null {
    const { currentNetwork } = useNetwork();
    const formatError = useMemo(() => validateTableName(rawName), [rawName]);
    const name = normalizeTableName(rawName);
    // The last name the chain said was taken (compared against the current name,
    // so a stale answer for a previous spelling never shows).
    const [takenName, setTakenName] = useState<string | null>(null);

    useEffect(() => {
        if (formatError || isBlank(name)) return;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            void fetchTableNameAvailable(currentNetwork.rest, name, controller.signal).then(available => {
                if (controller.signal.aborted) return;
                setTakenName(available === false ? name : null);
            });
        }, NAME_CHECK_DEBOUNCE_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [name, formatError, currentNetwork.rest]);

    if (formatError) return formatError;
    return hasContent(name) && takenName === name ? tableNameTakenMessage(name) : null;
}
