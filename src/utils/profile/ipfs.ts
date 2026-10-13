/**
 * IPFS / Arweave gateway handling for NFT avatars (ui#625).
 *
 * The play page must never hard-depend on a single public gateway: `ipfs.io` is
 * rate-limited and answered 403 (`Cross-Origin-Resource-Policy: same-origin`) on
 * a live avatar during the 2026-09-20 SNG test, blocking the cross-origin
 * `<img>`. So an `ipfs://` ref is content-addressed and can be rendered through
 * ANY gateway, and the avatar `<img>` steps through a fallback chain on error.
 *
 * Canonical form is the content address `ipfs://<cid>/<path>`. We parse the
 * shapes a gateway URL can take back to that ref, then render it through a chosen
 * gateway. No `ipfs.io` literal should exist in `src/` outside IPFS_GATEWAYS.
 */

import { viteEnv } from "../viteEnv";

const ARWEAVE_GATEWAY = "https://arweave.net/";

// Ordered gateway list; the avatar <img> onError chain and the metadata fetch
// (ui#774) both walk it in order. Configurable via VITE_IPFS_GATEWAYS
// (comma-separated origins, each the part before `/ipfs/<cid>`). Public gateways
// fail in turn — ipfs.io 403'd an <img> (CORP) in ui#625, dweb.link 503'd
// metadata in ui#774, cloudflare-ipfs.com has shut down — so no order is safe on
// its own; every caller must walk the list. ipfs.io stays last for the CORP
// reason. Prefer a gateway we control/pay for at the front in prod.
const DEFAULT_IPFS_GATEWAYS = ["https://gateway.pinata.cloud", "https://dweb.link", "https://w3s.link", "https://ipfs.io"];

const parseGatewayEnv = (raw: string | undefined): string[] => {
    if (!raw) {
        return DEFAULT_IPFS_GATEWAYS;
    }
    const parsed = raw
        .split(",")
        .map(s => s.trim().replace(/\/+$/, ""))
        .filter(s => s.startsWith("http://") || s.startsWith("https://"));
    return parsed.length > 0 ? parsed : DEFAULT_IPFS_GATEWAYS;
};

export const IPFS_GATEWAYS: string[] = parseGatewayEnv(viteEnv.VITE_IPFS_GATEWAYS);

/** A content-addressed IPFS reference: the CID and an optional trailing path. */
export interface IpfsRef {
    cid: string;
    path: string; // "" or "sub/path" — no leading slash
}

// A CIDv0 (Qm…) or CIDv1 (b…/z…/f…) — kept permissive; we only need to peel the
// gateway wrapping off, not fully validate the multihash.
const CID_RE = "[A-Za-z0-9]+";
const PATH_GATEWAY_RE = new RegExp(`^https?://[^/]+/ipfs/(${CID_RE})(?:/(.*))?$`, "i");
const SUBDOMAIN_GATEWAY_RE = new RegExp(`^https?://(${CID_RE})\\.ipfs\\.[^/]+(?:/(.*))?$`, "i");
// A bare CID, as some tokenURIs/images carry: CIDv0 (Qm + 44 base58) or a
// base32 CIDv1 (b + 50+ lowercase base32), with an optional path. Strict so an
// ordinary relative string is never mistaken for one.
const BARE_CID_RE = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})(?:\/(.*))?$/;

/**
 * Recognise a content-addressed IPFS ref from any of these shapes:
 *   - ipfs://<cid>/<path>
 *   - https://<gw>/ipfs/<cid>/<path>   (path gateway, incl. ipfs.io)
 *   - https://<cid>.ipfs.<gw>/<path>   (subdomain gateway)
 *   - <cid>/<path>                     (bare CIDv0 / base32 CIDv1)
 * Returns null for non-IPFS URLs (http(s) images, data:, arweave, …), which the
 * caller renders as-is.
 */
export const parseIpfsRef = (value: string | undefined | null): IpfsRef | null => {
    if (!value) {
        return null;
    }
    const v = value.trim();

    if (v.startsWith("ipfs://")) {
        const rest = v.slice("ipfs://".length).replace(/^ipfs\//, ""); // tolerate ipfs://ipfs/<cid>
        const [cid, ...pathParts] = rest.split("/");
        if (!cid) {
            return null;
        }
        return { cid, path: pathParts.join("/") };
    }

    const sub = v.match(SUBDOMAIN_GATEWAY_RE);
    if (sub) {
        return { cid: sub[1], path: sub[2] ?? "" };
    }

    const path = v.match(PATH_GATEWAY_RE);
    if (path) {
        return { cid: path[1], path: path[2] ?? "" };
    }

    const bare = v.match(BARE_CID_RE);
    if (bare) {
        return { cid: bare[1], path: bare[2] ?? "" };
    }

    return null;
};

/** Render a ref through the gateway at `index` (clamped) in IPFS_GATEWAYS. */
export const ipfsGatewayUrl = (ref: IpfsRef, index = 0): string => {
    const gw = IPFS_GATEWAYS[Math.min(Math.max(index, 0), IPFS_GATEWAYS.length - 1)];
    const suffix = ref.path ? `/${ref.path}` : "";
    return `${gw}/ipfs/${ref.cid}${suffix}`;
};

/** How many gateways are available to step through on error. */
export const ipfsGatewayCount = (): number => IPFS_GATEWAYS.length;

/**
 * Normalise any avatar URL for display: IPFS refs render through the first
 * gateway, ar:// through arweave, everything else (CDN URLs, data:) is returned
 * unchanged. The single display entry point the rest of the app imports.
 */
export const normalizeIpfsUri = (value: string | undefined | null): string => {
    if (!value) {
        return "";
    }
    const ref = parseIpfsRef(value);
    if (ref) {
        return ipfsGatewayUrl(ref, 0);
    }
    if (value.startsWith("ar://")) {
        return value.replace("ar://", ARWEAVE_GATEWAY);
    }
    return value;
};

/**
 * Every URL worth trying for a resource, in order: an IPFS ref through each
 * gateway, ar:// through arweave, anything else (https, data:) as given. Empty
 * input yields no candidates.
 */
export const ipfsCandidateUrls = (value: string | undefined | null): string[] => {
    if (!value || !value.trim()) {
        return [];
    }
    const ref = parseIpfsRef(value);
    if (ref) {
        return IPFS_GATEWAYS.map((_, i) => ipfsGatewayUrl(ref, i));
    }
    return [normalizeIpfsUri(value.trim())];
};

/**
 * Canonicalise an avatar URL to its content address for storage/chain state: an
 * IPFS ref becomes `ipfs://<cid>/<path>` so the gateway is NOT baked in and can
 * change later. Non-IPFS URLs pass through unchanged.
 */
export const toCanonicalAvatarRef = (value: string | undefined | null): string => {
    if (!value) {
        return "";
    }
    const ref = parseIpfsRef(value);
    if (ref) {
        return ref.path ? `ipfs://${ref.cid}/${ref.path}` : `ipfs://${ref.cid}`;
    }
    return value.trim();
};

export const isAllowedAvatarUrl = (url: string): boolean => {
    if (!url) {
        return false;
    }
    return url.startsWith("https://") || url.startsWith("http://") || url.startsWith("data:");
};
