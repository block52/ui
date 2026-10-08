import { useState, useEffect, useRef } from "react";
import { GameFormat } from "@block52/poker-vm-sdk";
import { useCosmosApi } from "../../context/CosmosApiContext";
import { parseGameRecordResponse } from "../../utils/handReplay";
import { toGameFormat } from "../../utils/gameFormatUtils";

/**
 * Each table's format (cash, sit-and-go, tournament), read once per table from
 * its chain Game record, so amounts can be shown in chips or USDC. A table
 * whose record can't be read stays absent from the map (its amounts show
 * without units).
 */
export function useTableFormats(gameIds: string[]): Map<string, GameFormat> {
    const cosmosApi = useCosmosApi();
    const [formats, setFormats] = useState<Map<string, GameFormat>>(new Map());
    const requested = useRef<{ api: unknown; ids: Set<string> }>({ api: null, ids: new Set() });
    const key = [...new Set(gameIds)].sort().join(",");

    useEffect(() => {
        // Another network is another chain view: look every table up again.
        if (requested.current.api !== cosmosApi) {
            requested.current = { api: cosmosApi, ids: new Set() };
            setFormats(new Map());
        }
        const ids = requested.current.ids;
        const missing = key.split(",").filter(id => id && !ids.has(id));
        for (const id of missing) {
            ids.add(id);
            cosmosApi
                .getGame(id)
                .then(res => {
                    const format = toGameFormat(parseGameRecordResponse(res).format);
                    if (format) setFormats(prev => new Map(prev).set(id, format));
                })
                .catch(err => console.error(`Failed to read the format of table ${id}:`, err));
        }
    }, [cosmosApi, key]);

    return formats;
}
