# @block52/pvm-stub

Local stub server so the UI runs **with no chain, funds, or bridge**. Modeled on
`dynamiq/h3-portal/packages/api-stub`.

Full design: [`ui/docs/plans/2026_07_11_wallet_stub_server.md`](../../docs/plans/2026_07_11_wallet_stub_server.md).

## Run

```bash
# from ui/
yarn stub                 # -> http://localhost:8546

# or from here
cd packages/pvm-stub && yarn && yarn start
```

## Point the UI at it

In the app's network dropdown (top-right), select **Stub** — its preset points
the SDK at this server's CometBFT RPC + chain WS on `:8546` (chain-direct; no
gateway). Your `/wallet` page should now show a funded USDC balance.

## Config (env)

| Var | Default | Meaning |
|-----|---------|---------|
| `PORT` | `8546` | listen port |
| `STUB_USDC` | `1000000000` | USDC balance in 6-decimal microunits (1000 USDC) |
| `STUB_STAKE` | `1000000000` | stake (gas) balance |

## How it works

- **Funded balance + health** — `/health`, `/cosmos/bank/.../balances/:addr`.
- **Lobby + state reads** — `list_games`, `game_state/:gameId`.
- **Chain WS** (`/ws`) — the UI subscribes and receives cosmos state frames
  (`{event, gameId, data:{format,variant,gameState}}`); see `chain-ws.ts`.
- **Chain-direct actions** — the UI's SDK client broadcasts poker Msgs over
  CometBFT JSON-RPC (`POST /`); `comet-rpc.ts` decodes them, drives the
  `holdem.ts` engine + auto-bot, and pushes the resulting frame over `/ws`.
- **Test control** — `/__control/{reset,config,inject,script,disconnect}` for
  deterministic e2e (see `packages/e2e`).
