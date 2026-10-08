# NFTs in Block52

Block52 uses Ethereum NFTs in two places:

1. **Profile avatars**: a player shows an NFT they own as their avatar at the table. **Live.**
2. **Sit & Go win NFTs**: a paid SNG finisher mints a commemorative NFT. **Wired, not live:** the contract isn't deployed.

Both rest on one on-chain record: the link between a player's Block52 (cosmos) address and an Ethereum address.

---

## 1. The on-chain record

`pokerchain` stores one `NftAvatar` per Block52 address (`x/poker`, collection `NftAvatars`, keyed by cosmos address):

| Field | Meaning |
|---|---|
| `cosmos_address` | the Block52 account (`b521…`) |
| `eth_address` | the Ethereum wallet that signed the registration (lower-cased) |
| `contract_address` | the NFT contract (lower-cased) |
| `token_id` | the NFT token id (decimal string) |

- **Write:** `MsgRegisterNftAvatar` (`x/poker/keeper/msg_server_register_nft_avatar.go`). Registering again overwrites the record.
- **Read:** `GET {rest}/pokerchain/poker/nft_avatar/{cosmos_address}` returns the four fields, or **404** when nothing is registered. Before pokerchain#382 it answered 500 "collections: not found"; the UI still treats that as "none" (`isNotRegisteredResponse`).
- **No delete message.** There is no chain message to remove an avatar (see *Known gaps*).

## 2. Registering an avatar

```
Player picks an NFT in the avatar dialog
  │
  ├─ 1. ETH wallet signs (EIP-191 personal_sign), with the exact text:
  │      I, <eth address lower-case>, authorize <b521… address> to use NFT <contract lower-case>:<tokenId>
  │
  ├─ 2. UI checks the signature recovers to that ETH address (ui#733)
  │
  ├─ 3. Block52 key signs and broadcasts MsgRegisterNftAvatar
  │      { creator: b521…, eth_address, contract_address, token_id, eth_signature }
  │
  └─ 4. Chain rebuilds the same text, ecrecovers the signer, and requires it to equal
         eth_address; then stores NftAvatar[creator] = { eth_address, contract, token_id }
```

- **Message text:** built in `utils/profile/nftRegistration.ts` (`buildNftAuthorizationMessage`). It must match the chain's `fmt.Sprintf` byte for byte.
- **Two signatures:** the cosmos tx signature proves the Block52 account sent it. The ETH signature proves the Ethereum wallet agreed to the link.

**What the chain does *not* check:** it never asks Ethereum whether `eth_address` owns the NFT. Ownership is only implied by the UI listing that wallet's NFTs. If the NFT is later sold, the record stays.

**The signer-mismatch failure (ui#733):** "signature verification failed: recovered address X does not match claimed address Y". The wallet signed with a different account from the one the app showed, for example another MetaMask account was selected, or a WalletConnect session was stale. The UI now:
- asks the wallet to sign with that exact account (`useSignMessage(message, account)`);
- checks the recovered signer before broadcasting (`assertNftAuthorizationSigner`), so the player gets a clear "switch your wallet to …" error instead of a failed chain tx.

## 3. Listing a wallet's NFTs (the avatar dialog)

The dialog is `components/profile/ProfileAvatarModal.tsx`; its state lives in `context/profile/ProfileAvatarContext.tsx`.

**No wallet connection is needed to see NFTs (ui#733).** The address whose NFTs are listed is, in order:

1. the **connected** ETH wallet;
2. an address the player **typed** in the dialog;
3. the ETH address **already linked on chain** (`NftAvatar.eth_address`), so a returning player sees their NFTs straight away.

Connecting is only required to **change** the avatar, because that needs the wallet's signature. Picking an NFT without a wallet opens the connect dialog.

**Where the list comes from** (`hooks/profile/useWalletNfts.ts`):
- `VITE_PROFILE_NFT_INDEXER_URL`, a URL template with `{owner}` and `{chainId}`, if set;
- otherwise the Alchemy NFT API (`/nft/v3/{key}/getNFTsForOwner`), built from the key in `VITE_MAINNET_RPC_URL`.

It follows up to 20 pages, de-duplicates by `contract:tokenId`, and prefers Alchemy's CDN thumbnail and cached image over raw IPFS (ui#625).

## 4. Showing avatars at the table

`getAvatarForAddress(address, playerAvatar)` in the context resolves a seat's image, in order:

1. **The seat's own `playerAvatar` string**, if the game state carries one: `nft:eip155:<chainId>/erc721:<contract>/<tokenId>|<image ref>` (`utils/profile/avatarPayload.ts`). Image refs are stored as `ipfs://…`, never as a gateway URL (ui#625).
2. **The current player's own avatar** (the dialog's selection).
3. **A session cache** of other players' avatars.
4. **A chain lookup**, done once per address per session: `GET …/nft_avatar/{address}`, then the image from the NFT contract itself (`utils/profile/nftImageResolver.ts`):
   - `eth_call tokenURI(id)`, falling back to `baseURI() + id`;
   - fetch the metadata JSON and take its `image`.

   This uses `VITE_MAINNET_RPC_URL` and no wallet.

**Rendering:** `components/profile/NftAvatarImage.tsx` tries each IPFS gateway in `VITE_IPFS_GATEWAYS` in turn before falling back to the "NFT" chip (ui#625, #701).

**Local cache:** your own selection is kept in `localStorage` (`b52_nft_avatar`, keyed by Block52 address) so it shows instantly on reload.

## 5. Sit & Go win NFTs (not live)

Flow (`components/modals/SitAndGoResultModal.tsx`):

1. A paid finisher clicks **Claim NFT**.
2. The UI fetches a validator-signed payload: `GET {rest}/block52/pokerchain/poker/v1/sng_claim_signature/{gameId}/{b521…}`. The chain (`query_sng_claim_signature.go`):
   - checks there's a paid result for that address;
   - takes the **recipient from `NftAvatar.eth_address`**, so the player must have registered an avatar first;
   - signs `keccak256(abi.encodePacked(recipient, gameId, place, payout, timestamp, format))` with the validator's `validator_eth_private_key`, using an EIP-191 prefix.
3. `hooks/wallet/useClaimSngWinNFT.ts` calls `SngWinNFT.claim(...)` from the player's wallet.

**Status:** `SNG_WIN_NFT_ADDRESS` in `config/constants.ts` is the zero address until the contract is deployed (poker-vm#2119 umbrella, #2120 contract, pokerchain#202 query). Until then the claim raises "contract not yet deployed".

Only a validator node can answer the signature query, because other nodes have no `validator_eth_private_key`.

## 6. Configuration

| Variable | Used for |
|---|---|
| `VITE_PROFILE_NFT_INDEXER_URL` | NFT listing URL template (`{owner}`, `{chainId}`). Optional. |
| `VITE_MAINNET_RPC_URL` | Ethereum RPC for `tokenURI` lookups. Its Alchemy key is the fallback NFT listing source. |
| `VITE_PROFILE_NFT_CHAIN_ID` | Chain id the listing uses (default `ETH_CHAIN_ID`). |
| `VITE_IPFS_GATEWAYS` | Comma-separated IPFS gateways, highest priority first. |

These are build-time `VITE_` values, so any API key in them ships in the browser bundle. Use a key restricted to the app's origin.

## 7. Known gaps

- **Clear Avatar is local only.** It hides the avatar in this browser (`b52_nft_avatar_cleared`), but the chain record stays and other players still see it. The chain has no message to remove a record.
- **No ownership check on chain** (see §2). A sold NFT stays registered.
- **One Ethereum network.** Listing and image lookup use one network (`VITE_PROFILE_NFT_CHAIN_ID` / `VITE_MAINNET_RPC_URL`). The record doesn't say which chain the contract is on.
- **Dead code:** `hooks/profile/useNftRegistration.ts` and `signNftAuthorization` (`window.ethereum`) duplicate the context's flow and are unused.
- **Open:** #733 (dialog polish), #196 (play for NFTs), #639 (avatar 500 at an SNG). PR #673 (gateway fallbacks) is superseded by #701.

## File map

| Area | Files |
|---|---|
| Dialog + state | `components/profile/ProfileAvatarModal.tsx`, `ProfileAvatarButton.tsx`, `context/profile/ProfileAvatarContext.tsx` |
| Registration | `utils/profile/nftRegistration.ts`, `hooks/wallet/useSignMessage.ts` |
| Listing | `hooks/profile/useWalletNfts.ts` |
| Images | `utils/profile/nftImageResolver.ts`, `utils/profile/ipfs.ts`, `utils/profile/avatarPayload.ts`, `components/profile/NftAvatarImage.tsx` |
| SNG win NFT | `hooks/game/useFetchSngClaimSignature.ts`, `hooks/wallet/useClaimSngWinNFT.ts`, `abis/sngWinNftABI.ts`, `components/modals/SitAndGoResultModal.tsx` |
| Chain | `pokerchain/x/poker/keeper/msg_server_register_nft_avatar.go`, `query_nft_avatar.go`, `query_sng_claim_signature.go` |
