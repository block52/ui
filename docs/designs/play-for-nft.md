# Design: Play for NFTs — ETH escrow keyed by gameId, validator-signed release

Status: draft · Issue: block52/ui#196 · Author: design pass 2026-10-11

## Goal

A table/SNG creator escrows an **ERC-721 NFT** on Ethereum as the prize. The
poker-chain runs the game as normal. When the game resolves, the **winner pulls**
the NFT out of the ETH escrow by presenting a **validator-signed unlock** — the
same single-validator ECDSA scheme the USDC withdrawal bridge already uses. If
the game is cancelled before a winner exists, the chain issues a validator-signed
**refund** to the depositor instead.

**Scope: SNG only, winner-takes-all.** Play-for-NFT is restricted to Sit & Go
with a single prize NFT released only to **1st place**. SNG resolution produces a
single, unambiguous winner in `GameState.Results`, which is exactly the identity
the unlock is signed for — no place tiers, no `place` field. Cash tables (no
natural single winner) and NFT *buy-ins* (each player's NFT is the stake) are out
of scope for this pass; the creator escrows one prize NFT per SNG.

## Why this shape

The codebase already has the exact precedent — `SngWinNFT.claim(recipient,
gameId, place, payout, timestamp, format, signature)` — a validator-signed,
double-claim-guarded ERC-721 grant verified by `IValidator(vault).isValidator()`.
The NFT escrow is the **same pattern with the asset flowing the other way**: the
NFT is *held* in escrow (deposited by the creator) rather than *minted* on claim.
Reusing the signing path (`WithdrawalSigningHash` / `BuildWithdrawalSignature`)
and the validator whitelist (`Vault.isValidator`) means **no new trust surface**.

### Decisions locked with the user
- **Prize source:** table creator escrows the NFT at creation.
- **Unlock auth:** reuse the existing bridge validator-signing scheme (single
  validator, EIP-191 keccak256, verified against `Vault.isValidator`).
- **Claimant:** winner pulls, presenting the signature, paying their own gas.
- **Refund:** chain-signed refund to depositor on cancellation (authoritative,
  same scheme) — not a unilateral timeout reclaim.
- **Winner ETH address:** provided at claim time; the chain signs only for the
  address the actual winner's cosmos identity requests.

## Components

| Component | Where | Role |
|---|---|---|
| `NFTPrizeEscrow.sol` | `poker-vm/contracts/contracts/` | Holds one ERC-721 per `gameId`; releases on a validator-signed unlock (claim *or* refund). |
| poker-chain `x/poker` | `pokerchain/x/poker/` | Tracks prize presence per `gameId`, gates SNG start on confirmed deposit, authors the unlock request on resolve/cancel, validators sign it. |
| Validator set | existing | Signs the unlock, same path as USDC withdrawal — `Vault.isValidator` whitelist. |
| Gateway indexer | existing | Observes `PrizeDeposited` / `PrizeReleased` events and drives the matching chain messages. |

Keyed by **`gameId`** throughout — there is no table account on-chain, so `gameId`
(the `0x`-keccak256 id from `DeriveGameId`) is the escrow key.

## Contract: `NFTPrizeEscrow.sol`

Mirrors `SngWinNFT`'s auth model; holds the asset instead of minting it.

```solidity
struct Prize {
    address nftContract;
    uint256 tokenId;
    address depositor;     // creator — refund recipient
    bool    released;      // consumed flag (replay guard)
}
mapping(bytes32 => Prize) public prizes;   // gameId => Prize

address public vault;      // IValidator whitelist (same Vault the bridge uses)

// Creator escrows the prize in ONE transaction: the NFT's own
// safeTransferFrom(creator, escrow, tokenId, data) delivers the token AND the
// gameId in `data`, and the ERC721 standard calls onERC721Received here. No
// prior approve()/second tx — the creator just transfers the NFT to the escrow
// with the gameId as the payload.
function onERC721Received(
    address /*operator*/,
    address from,          // the depositor (creator)
    uint256 tokenId,
    bytes calldata data    // abi.encode(bytes32 gameId)
) external returns (bytes4) {
    bytes32 gameId = abi.decode(data, (bytes32));
    require(gameId != bytes32(0), "gameId required");
    require(prizes[gameId].nftContract == address(0), "prize exists");
    // msg.sender is the ERC721 contract itself (it's calling the hook).
    prizes[gameId] = Prize(msg.sender, tokenId, from, false);
    emit PrizeDeposited(gameId, msg.sender, tokenId, from);
    return this.onERC721Received.selector;   // ERC721_RECEIVED magic value
}

// Release: validator-signed. `kind` distinguishes WIN (→ recipient) vs
// REFUND (→ depositor). One signature, verified against the validator whitelist.
// nonce is the chain-issued per-game nonce; `released` is the replay guard.
function release(
    bytes32 gameId,
    address recipient,
    uint8   kind,          // 1 = WIN, 2 = REFUND
    bytes32 nonce,
    bytes calldata signature
) external {
    Prize storage p = prizes[gameId];
    require(p.nftContract != address(0), "no prize");
    require(!p.released, "released");

    // For REFUND the recipient MUST be the depositor; the chain enforces this
    // too, but the contract pins it so a win-signature can't be redirected.
    if (kind == 2) require(recipient == p.depositor, "refund != depositor");

    bytes32 h = _ethSignedHash(
        keccak256(abi.encodePacked(gameId, recipient, kind, nonce))
    );
    address signer = ECDSA.recover(h, signature);
    require(IValidator(vault).isValidator(signer), "not validator");

    p.released = true;
    IERC721(p.nftContract).safeTransferFrom(address(this), recipient, p.tokenId);
    emit PrizeReleased(gameId, recipient, kind, nonce);
}
```

Notes:
- **Signed message:** `keccak256(abi.encodePacked(gameId, recipient, kind, nonce))`
  then EIP-191 prefix — structurally identical to `WithdrawalSigningHash`
  (`receiver, amount, nonce`) so the chain's existing signing helper can be
  reused with a different payload.
- **Replay guard:** `released` bool per `gameId` (one prize, one release). The
  `nonce` is still signed so a signature can't be reused across a re-created
  game id, and matches the bridge's nonce convention.
- **Win vs refund are mutually exclusive** — whichever is signed and submitted
  first consumes the prize.

## Chain: `x/poker` additions

### State
- `NFTPrize{ gameId, nftContract, tokenId, depositor(eth), confirmed(bool), nonce }`
  keyed by `gameId`. `confirmed` flips true when the gateway reports
  `PrizeDeposited` at sufficient confirmations.

### Messages
- `MsgRegisterNFTPrize{ gameId, nftContract, tokenId, depositorEth }` — creator
  declares the intended prize at/after game creation (before start). Chain records
  it unconfirmed.
- `MsgConfirmNFTPrizeDeposit{ gameId, ethTxRef }` — gateway-only; flips
  `confirmed` after observing `PrizeDeposited`. **SNG start is gated on this** so
  the prize can't be yanked mid-game.
- `MsgRequestNFTUnlock{ gameId, recipientEth }` — the resolution trigger:
  - If the game has a recorded winner and the caller's cosmos identity **is** the
    winner → authorize a **WIN** unlock to `recipientEth` (the address the winner
    supplies now).
  - If the game is cancelled/aborted pre-winner and caller is the depositor's
    cosmos identity → authorize a **REFUND** to the depositor's ETH address.
  - Produces the unlock request the validators sign.

### Signing
- Reuse the withdrawal signing helper with the escrow payload:
  `NFTUnlockSigningHash(gameId, recipient, kind, nonce)` = EIP-191(keccak256(
  abi.encodePacked(gameId, recipient, kind, nonce))). Validators sign with the
  same `VALIDATOR_ETH_PRIVATE_KEY`; submit via a `MsgSubmitNFTUnlockSignature`
  twin of `MsgSubmitWithdrawalSignature`; served via a query like
  `WithdrawalSignature`.

### Winner identity → ETH recipient
"Provided at claim" — the winner calls `MsgRequestNFTUnlock` with the ETH address
they want. The chain only signs if the **caller's cosmos address is the recorded
winner** for that `gameId` (from `GameState.Results`). The recipient address is
not pre-bound, so no join-time link step is needed. (`NftAvatar`'s cosmos→ETH
mapping could optionally pre-fill the UI, but is not authoritative here.)

## End-to-end flow

```
CREATE
  creator → MsgCreateGame (normal)  → gameId
  creator → IERC721(nft).safeTransferFrom(creator, escrow, tokenId, abi.encode(gameId))
            ↳ ERC721 calls escrow.onERC721Received → records prize    [ETH, ONE tx, no approve]
  gateway observes PrizeDeposited → MsgConfirmNFTPrizeDeposit(gameId)
  chain: NFTPrize.confirmed = true   (SNG start gated on this)

PLAY
  normal SNG/tournament; engine records winner in GameState.Results

RESOLVE (win)
  winner → MsgRequestNFTUnlock(gameId, recipientEth)
  chain verifies caller == recorded winner → unlock{gameId, recipientEth, WIN, nonce}
  validators sign (reuse withdrawal signer) → signature served via query
  winner → NFTPrizeEscrow.release(gameId, recipientEth, WIN, nonce, sig)  [ETH, winner pays gas]
         → verify validator sig, !released → ERC721 → winner

CANCEL (refund)
  chain marks game cancelled (never filled / aborted pre-start)
  depositor → MsgRequestNFTUnlock(gameId, depositorEth)
  chain verifies caller == depositor & game cancelled → unlock{..., REFUND, nonce}
  validators sign → depositor → release(gameId, depositorEth, REFUND, nonce, sig)
```

## Edge cases & guards

- **Deposit never happens / under-confirmed:** the SNG cannot start (start gate on
  `confirmed`); until confirmed, the table shows the prize as unconfirmed.
- **Double claim / win-vs-refund race:** `released` bool on the contract is the
  single source of truth; first valid release wins, the other reverts.
- **Win signature redirected to a different address:** impossible — the recipient
  is inside the signed hash; changing it invalidates the signature.
- **Refund signature redirected:** contract additionally pins `recipient ==
  depositor` for `kind == REFUND`.
- **Re-created gameId collision:** `gameId` is keccak256(timestamp‖creator), so
  practically unique; the per-game `nonce` in the signed payload is the backstop.
- **Validator set churn between sign and claim:** as with USDC withdrawals, the
  contract checks `isValidator(signer)` at claim time — if the signer unstaked,
  the claim fails. Mitigate by having multiple validators sign (any one suffices)
  and claiming promptly. Same property the bridge already lives with.
- **Wrong-chain NFT:** escrow is ETH/Base-side only; the chain records
  `nftContract` but never custodies it — trust boundary identical to the bridge.

## Reuse map (what already exists)

| Need | Existing primitive |
|---|---|
| Validator signature over keccak256+EIP-191 | `WithdrawalSigningHash` / `BuildWithdrawalSignature` (`withdrawal_keeper.go`) |
| Submit signature tx + query | `MsgSubmitWithdrawalSignature`, `query_withdrawal_signature.go` |
| On-chain validator whitelist | `Vault.isValidator` / `IValidator` |
| Validator-signed ERC-721 grant precedent | `SngWinNFT.claim(...)` |
| Game id as escrow key | `DeriveGameId` → `0x`-keccak256 |
| cosmos↔ETH address mapping (optional UI pre-fill) | `NftAvatar` / `RegisterNFTAvatar` |
| NFT metadata/image in UI | `nftImageResolver.ts` |

## Open questions for review

1. ~~**Cash tables vs SNG**~~ — **Resolved: SNG only.** Single winner in
   `Results` is the signed identity; cash is out of scope.
2. ~~**Multiple prizes / place tiers**~~ — **Resolved: winner-takes-all.** One
   prize NFT, released only to 1st place. No 2nd/3rd tiers. The unlock signs only
   the single winner from `Results`; no `place` field is needed.
3. ~~**Approve UX**~~ — **Resolved: one-tx via `onERC721Received`.** The creator
   escrows by calling the NFT's own `safeTransferFrom(creator, escrow, tokenId,
   abi.encode(gameId))`; the ERC721 standard invokes the escrow's
   `onERC721Received` hook, which records the prize. No separate `approve`, no
   `depositPrize` entrypoint, single transaction.
4. ~~**Gas sponsorship**~~ — **Resolved: winner pays ETH gas.** The winner submits
   the `release(...)` call themselves and pays the Ethereum gas. No relayer / no
   gasless path. (A relayer could be added later without touching the contract —
   it would just submit the same validator-signed `release` call on the winner's
   behalf — but it is explicitly out of scope.)
```
