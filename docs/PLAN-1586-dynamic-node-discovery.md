# Implementation Plan: Dynamic Node Discovery (Issue #1586)

## Overview

Currently, nodes are hardcoded in `ui/src/context/NetworkContext.tsx`. This plan outlines how to implement dynamic node discovery by crawling the network for peers.

## Current State

- Nodes defined in `NETWORK_PRESETS` array (4 hardcoded nodes)
- No automatic discovery of new nodes joining the network

## Discovery Strategy

### Available APIs

1. **Validators API** (`/cosmos/staking/v1beta1/validators`)
   - Returns validator monikers: `validator-block52`, `validator-texashodl`, `validator-3`
   - Does NOT contain node endpoints (only operator addresses and consensus pubkeys)

2. **Net Info RPC** (`/rpc/net_info`)
   - Returns connected peers with:
     - `node_info.id` - Node ID
     - `node_info.moniker` - Node name
     - `node_info.listen_addr` - P2P listen address
     - `remote_ip` - Peer's IP address
   - Example peers found:
     - `node1` at `node1.block52.xyz:26656`
     - `sync-node-139.180.181.33` at `139.180.181.33`
     - `validator-3` at `157.230.251.49`

3. **Node Info API** (`/cosmos/base/tendermint/v1beta1/node_info`)
   - Returns current node's info (moniker, version, network)

## Implementation Plan

### Step 1: Create Node Discovery Service

**File:** `ui/src/services/nodeDiscovery.ts`

```typescript
interface DiscoveredNode {
  id: string;
  moniker: string;
  remoteIp: string;
  listenAddr: string;
  endpoints?: NetworkEndpoints;  // Resolved endpoints if reachable
  status: 'unknown' | 'online' | 'offline';
  lastChecked?: Date;
}

async function discoverPeers(seedNode: NetworkEndpoints): Promise<DiscoveredNode[]>
async function probeNodeEndpoints(ip: string): Promise<NetworkEndpoints | null>
async function validateNode(endpoints: NetworkEndpoints): Promise<boolean>
```

### Step 2: Endpoint Resolution Logic

Since P2P addresses don't directly map to REST endpoints, we need to probe common patterns:

1. **Domain-based nodes** (e.g., `node1.block52.xyz:26656`)
   - Try `https://{domain}` for REST
   - Try `https://{domain}/rpc/` for RPC
   - Try `wss://{domain}/ws` for WebSocket

2. **IP-based nodes** (e.g., `139.180.181.33`)
   - Try `http://{ip}:1317` for REST
   - Try `http://{ip}:26657` for RPC
   - May not be publicly accessible (firewalled)

### Step 3: Update NetworkContext

**File:** `ui/src/context/NetworkContext.tsx`

Changes:
- Keep `NETWORK_PRESETS` as seed/fallback nodes
- Add `discoveredNodes` state
- Add `discoverNodes()` function that crawls from seed nodes
- Merge discovered nodes with presets (dedup by moniker/IP)
- Cache discovered nodes in localStorage with TTL

### Step 4: Create Nodes List Page

**File:** `ui/src/pages/NodesListPage.tsx`

Features:
- Show all known nodes (presets + discovered)
- Real-time status indicator (online/offline)
- "Discover More Nodes" button to trigger crawl
- Auto-refresh status every 30 seconds
- Filter by status (online/offline/all)

### Step 5: Update Node Status Page

**File:** `ui/src/pages/NodeStatusPage.tsx`

Changes:
- Accept both preset and discovered nodes
- Show discovery source (preset vs discovered)
- Add "peers" section showing connected peers

## API Endpoints to Use

| Endpoint | Purpose |
|----------|---------|
| `GET /rpc/net_info` | Discover connected peers |
| `GET /cosmos/base/tendermint/v1beta1/node_info` | Validate node is alive |
| `GET /cosmos/base/tendermint/v1beta1/blocks/latest` | Get block height/status |
| `GET /cosmos/staking/v1beta1/validators` | Get validator info |

## Edge Cases & Considerations

1. **Private/Firewalled Nodes**: Many nodes only expose P2P port, not REST. Mark as "discovered but unreachable"

2. **Rate Limiting**: Don't probe too aggressively. Use exponential backoff.

3. **Caching**: Cache discovered nodes for 1 hour to avoid repeated crawls

4. **Seed Node Failure**: If primary seed node is down, try secondary seeds

5. **Duplicate Detection**: Same node may appear with different IPs/monikers

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `ui/src/services/nodeDiscovery.ts` | Create | Node discovery service |
| `ui/src/context/NetworkContext.tsx` | Modify | Add discovery integration |
| `ui/src/pages/NodesListPage.tsx` | Create | Nodes list with discovery |
| `ui/src/pages/NodeStatusPage.tsx` | Modify | Add peers section |
| `ui/src/App.tsx` | Modify | Add route for nodes list |

## Testing Checklist

- [ ] Discover peers from Texas Hodl seed node
- [ ] Probe and validate Block52 node endpoints
- [ ] Handle offline nodes gracefully
- [ ] Cache works correctly (localStorage)
- [ ] UI shows discovered vs preset nodes
- [ ] "Discover More Nodes" button works
- [ ] Auto-refresh updates status correctly
- [ ] Mobile responsive design

## Future Enhancements

1. **Recursive Crawling**: Crawl peers of peers for deeper discovery
2. **Health Scoring**: Score nodes by latency, uptime, block height
3. **Geographic Distribution**: Show node locations on a map
4. **Validator Matching**: Match discovered nodes to validators
