/**
 * IPFS reference handling for avatars (ui#625).
 *
 * A CID is the identity of the bytes; a gateway is just one place to fetch
 * them from. So nothing here stores a gateway URL — we parse whatever form we
 * are given back to `{ cid, path }` and render it against the CONFIGURED
 * gateway list at the moment of display, falling through the list when one
 * refuses us.
 *
 * The 2026-09-20 SNG session is why: every avatar was fetched from the public
 * `ipfs.io`, which answered `403` with `Cross-Origin-Resource-Policy:
 * same-origin`, so the browser blocked the cross-origin `<img>` and every
 * player fell back to the "NFT" text chip. A rate-limited public gateway
 * cannot be a runtime dependency of the play page, and with the gateway baked
 * into chain state there was no second one to try.
 *
 * Configure with `VITE_IPFS_GATEWAYS` (comma-separated, highest priority
 * first). Entries may be written with or without the trailing `/ipfs/`.
 */
import { viteEnv } from "../viteEnv";

/**
 * Used when `VITE_IPFS_GATEWAYS` is unset. Deployments should point the first
 * entry at a gateway we control or pay for (a Pinata/Filebase dedicated
 * gateway, or our own CDN); these are public fallbacks, not a CDN.
 */
const DEFAULT_IPFS_GATEWAYS = ["https://dweb.link/ipfs/", "https://w3s.link/ipfs/", "https://ipfs.io/ipfs/"];

const ARWEAVE_GATEWAY = "https://arweave.net/";

/**
 * A CID as it appears in a URL. Deliberately permissive — we are routing a
 * string to a gateway, not validating multihashes: base58 v0 (`Qm…`, 46 chars)
 * and base32 v1 (`bafy…`, 59) both satisfy it, while path segments like
 * `ipfs` or `390` do not.
 */
const CID_PATTERN = /^[A-Za-z0-9]{46,}$/;

/** An IPFS reference: the content address, plus any path inside it. */
export interface IpfsRef {
    cid: string;
    /** Path within the CID, without a leading slash. Empty when the CID is the file. */
    path: string;
}

/** Normalize a configured gateway to a prefix a `<cid>/<path>` is appended to. */
const normalizeGateway = (raw: string): string => {
    const trimmed = raw.trim().replace(/\/+$/, "");
    if (!trimmed) {
        return "";
    }
    return trimmed.endsWith("/ipfs") ? `${trimmed}/` : `${trimmed}/ipfs/`;
};

/** The gateway chain, highest priority first. Never empty. */
export const getIpfsGateways = (): string[] => {
    const configured = (viteEnv.VITE_IPFS_GATEWAYS || "")
        .split(",")
        .map(normalizeGateway)
        .filter(Boolean);

    return configured.length > 0 ? configured : DEFAULT_IPFS_GATEWAYS;
};

/**
 * Recognize every form an IPFS reference reaches us in and reduce it to the
 * content address:
 *   - `ipfs://<cid>/<path>` and the legacy `ipfs://ipfs/<cid>/<path>`
 *   - `https://<gateway>/ipfs/<cid>/<path>` (any gateway, including ipfs.io)
 *   - `https://<cid>.ipfs.<gateway>/<path>` (subdomain gateways)
 *
 * Returns null for anything that is not IPFS — an ordinary https URL, a
 * `data:` URI, an `ar://` reference.
 */
export const parseIpfsRef = (value: string | undefined | null): IpfsRef | null => {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const build = (cid: string, rest: string): IpfsRef | null => {
        if (!CID_PATTERN.test(cid)) {
            return null;
        }
        return { cid, path: rest.replace(/^\/+/, "") };
    };

    if (trimmed.startsWith("ipfs://")) {
        const withoutScheme = trimmed.slice("ipfs://".length).replace(/^ipfs\//, "");
        const slash = withoutScheme.indexOf("/");
        return slash === -1 ? build(withoutScheme, "") : build(withoutScheme.slice(0, slash), withoutScheme.slice(slash));
    }

    if (!/^https?:\/\//i.test(trimmed)) {
        return null;
    }

    // Subdomain gateway: <cid>.ipfs.<host>. Matched against the RAW string, not
    // URL.hostname — hostnames are lowercased, which silently corrupts a
    // case-sensitive base58 CIDv0.
    const subdomainMatch = trimmed.match(/^https?:\/\/([A-Za-z0-9]+)\.ipfs\.[^/?#]+(\/[^?#]*)?/i);
    if (subdomainMatch) {
        return build(subdomainMatch[1], subdomainMatch[2] || "");
    }

    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        return null;
    }

    // Path gateway: /ipfs/<cid>/<path>
    const pathMatch = url.pathname.match(/^\/ipfs\/([^/]+)(\/.*)?$/);
    if (pathMatch) {
        return build(pathMatch[1], pathMatch[2] || "");
    }

    return null;
};

/** The canonical, gateway-free form — this is what belongs in storage. */
export const ipfsRefToUri = ({ cid, path }: IpfsRef): string => (path ? `ipfs://${cid}/${path}` : `ipfs://${cid}`);

/** Render a reference against one gateway. */
export const ipfsGatewayUrl = ({ cid, path }: IpfsRef, gateway: string): string => {
    const prefix = normalizeGateway(gateway);
    return path ? `${prefix}${cid}/${path}` : `${prefix}${cid}`;
};

/**
 * Every URL worth trying for a value, in order. For an IPFS reference that is
 * one URL per configured gateway; for anything else it is the value itself,
 * so callers can treat all avatars the same way.
 */
export const ipfsCandidateUrls = (value: string | undefined | null): string[] => {
    if (!value) {
        return [];
    }

    const ref = parseIpfsRef(value);
    if (ref) {
        return getIpfsGateways().map(gateway => ipfsGatewayUrl(ref, gateway));
    }

    const trimmed = value.trim();
    if (trimmed.startsWith("ar://")) {
        return [trimmed.replace("ar://", ARWEAVE_GATEWAY)];
    }

    return trimmed ? [trimmed] : [];
};

/**
 * The single URL to show first. Kept for callers that render one `<img>` and
 * cannot step through gateways; prefer `ipfsCandidateUrls` where you can.
 */
export const normalizeIpfsUri = (value: string | undefined | null): string => ipfsCandidateUrls(value)[0] ?? "";

/**
 * The form to PERSIST — content-addressed, so the gateway can change later
 * without rewriting what is already stored (on chain, we cannot rewrite it).
 * Non-IPFS values are returned untouched.
 */
export const toCanonicalIpfsUri = (value: string | undefined | null): string => {
    if (!value) {
        return "";
    }
    const ref = parseIpfsRef(value);
    return ref ? ipfsRefToUri(ref) : value.trim();
};

export const isAllowedAvatarUrl = (url: string): boolean => {
    if (!url) {
        return false;
    }

    return url.startsWith("https://") || url.startsWith("http://") || url.startsWith("data:");
};
