import React, { useState } from "react";
import { SigningCosmosClient, GameFormat } from "@block52/poker-vm-sdk";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { getCosmosMnemonic } from "../utils/cosmos/storage";
import { useNetwork } from "../context/NetworkContext";
import { USDC_TO_MICRO, microToUsdc } from "../constants/currency";
import { Modal } from "../components/common/Modal";
import { PillLink } from "../components/ui";
import { isEmpty } from "../utils/guards";
import { isTournamentFormat, toGameFormat } from "../utils/gameFormatUtils";
import styles from "./TestSigningPage.module.css";
import { copyToClipboard } from "../utils/clipboard";

interface TestResult {
    functionName: string;
    status: "pending" | "success" | "error";
    message: string;
    txHash?: string;
    data?: any;
}

export default function TestSigningPage() {
    const { currentNetwork } = useNetwork(); // Get current network from context
    const [signingClient, setSigningClient] = useState<SigningCosmosClient | null>(null);
    const [, setWallet] = useState<DirectSecp256k1HdWallet | null>(null);
    const [walletAddress, setWalletAddress] = useState<string>("");
    const [balances, setBalances] = useState<{ denom: string; amount: string }[]>([]);
    const [testResults, setTestResults] = useState<TestResult[]>([]);
    const [isInitializing, setIsInitializing] = useState(false);

    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string>("");

    const [recipientAddress, setRecipientAddress] = useState("");
    const [sendAmount, setSendAmount] = useState("1"); // 1 usdc (in dollar units, will convert to micro-units)
    const [sendDenom, setSendDenom] = useState("usdc");
    const [gameFormat, setGameFormat] = useState<GameFormat>(GameFormat.SIT_AND_GO);
    const [minPlayers, setMinPlayers] = useState(2);
    const [maxPlayers, setMaxPlayers] = useState(6);
    const [minBuyIn, setMinBuyIn] = useState("5000000"); // 5 usdc
    const [maxBuyIn, setMaxBuyIn] = useState("50000000"); // 50 usdc (max you can afford!)
    const [sitAndGoBuyIn, setSitAndGoBuyIn] = useState("10000000"); // 10 usdc for sit-and-go
    const [smallBlind, setSmallBlind] = useState("100000"); // 0.1 usdc
    const [bigBlind, setBigBlind] = useState("200000"); // 0.2 usdc
    const [timeout, setTimeout] = useState(30);
    const [gameId, setGameId] = useState("");
    const [seat, setSeat] = useState(1);
    const [buyInAmount, setBuyInAmount] = useState("10000000"); // 10 usdc - matches sit-and-go default
    const [action, setAction] = useState("fold");
    const [actionAmount, setActionAmount] = useState("0");

    // Test accounts from genesis - Static addresses from TEST_ACTORS.md
    const TEST_ACCOUNTS = [
        {
            name: "alice",
            address: "b521dfe7r39q88zeqtde44efdqeky9thdtwngkzy2y",
            mnemonic:
                "cement shadow leave crash crisp aisle model hip lend february library ten cereal soul bind boil bargain barely rookie odor panda artwork damage reason"
        },
        {
            name: "bob",
            address: "b521hg93rsm2f5v3zlepf20ru88uweajt3nf492s2p",
            mnemonic:
                "vanish legend pelican blush control spike useful usage into any remove wear flee short october naive swear wall spy cup sort avoid agent credit"
        },
        {
            name: "charlie",
            address: "b521xkh7eznh50km2lxh783sqqyml8fjwl0tqjsc0c",
            mnemonic:
                "video short denial minimum vague arm dose parrot poverty saddle kingdom life buyer globe fashion topic vicious theme voice keep try jacket fresh potato"
        },
        {
            name: "diana",
            address: "b521n25h4eg6uhtdvs26988k9ye497sylum8lz5vns",
            mnemonic:
                "twice bacon whale space improve galaxy liberty trumpet outside sunny action reflect doll hill ugly torch ride gossip snack fork talk market proud nothing"
        }
    ];

    const copyCommand = async (account: string, denom: string, amount: string) => {
        const command = `pokerchaind tx bank send ${account} ${walletAddress} ${amount}${denom} --chain-id pokerchain --keyring-backend test -y`;
        await copyToClipboard(command, "Command copied to clipboard");
    };

    React.useEffect(() => {
        if (!signingClient && !isInitializing) {
            initializeClient();
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const addResult = (result: TestResult) => {
        setTestResults(prev => [result, ...prev]);
    };

    const initializeClient = async () => {
        setIsInitializing(true);
        addResult({
            functionName: "Initialize SigningCosmosClient",
            status: "pending",
            message: "Initializing client with mnemonic..."
        });

        try {
            const mnemonic = getCosmosMnemonic();
            if (!mnemonic) {
                throw new Error("No mnemonic found. Please create a wallet first at /wallet");
            }

            const hdWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
                prefix: "b52"
            });

            const [account] = await hdWallet.getAccounts();

            // Create SigningCosmosClient using NetworkContext
            const client = new SigningCosmosClient({
                rpcEndpoint: currentNetwork.rpc,
                restEndpoint: currentNetwork.rest,
                chainId: "pokerchain",
                prefix: "b52",
                denom: "stake",
                gasPrice: "0stake", // Gasless
                wallet: hdWallet
            });

            setSigningClient(client);
            setWallet(hdWallet);
            setWalletAddress(account.address);

            const userBalances = await client.getAllBalances(account.address);
            setBalances(userBalances);

            addResult({
                functionName: "Initialize SigningCosmosClient",
                status: "success",
                message: "Client initialized successfully!",
                data: {
                    network: currentNetwork.name,
                    address: account.address,
                    balances: userBalances,
                    rpcEndpoint: currentNetwork.rpc,
                    restEndpoint: currentNetwork.rest
                }
            });
        } catch (error) {
            console.error("❌ Failed to initialize:", error);
            addResult({
                functionName: "Initialize SigningCosmosClient",
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        } finally {
            setIsInitializing(false);
        }
    };

    const testGetWalletAddress = async () => {
        if (!signingClient) {
            addResult({
                functionName: "getWalletAddress()",
                status: "error",
                message: "Client not initialized"
            });
            return;
        }

        addResult({
            functionName: "getWalletAddress()",
            status: "pending",
            message: "Getting wallet address..."
        });

        try {
            const address = await signingClient.getWalletAddress();

            addResult({
                functionName: "getWalletAddress()",
                status: "success",
                message: `Address: ${address}`,
                data: { address }
            });
        } catch (error) {
            console.error("❌ getWalletAddress() failed:", error);
            addResult({
                functionName: "getWalletAddress()",
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    };

    const testSendTokens = async () => {
        if (!signingClient || !walletAddress) {
            addResult({
                functionName: "sendTokens()",
                status: "error",
                message: "Client not initialized"
            });
            return;
        }

        if (!recipientAddress) {
            addResult({
                functionName: "sendTokens()",
                status: "error",
                message: "Please enter recipient address"
            });
            return;
        }

        addResult({
            functionName: "sendTokens()",
            status: "pending",
            message: `Sending ${sendAmount} to ${recipientAddress}...`
        });

        try {
            // Validate the dollar amount
            const dollarAmount = parseFloat(sendAmount);
            if (isNaN(dollarAmount) || dollarAmount <= 0) {
                throw new Error("Amount must be a positive number");
            }

            // Convert dollars to micro-units (multiply by 1,000,000)
            const microUnits = Math.floor(dollarAmount * USDC_TO_MICRO);

            const txHash = await signingClient.sendTokens(walletAddress, recipientAddress, BigInt(microUnits), sendDenom, "Test transfer via SDK");

            addResult({
                functionName: "sendTokens()",
                status: "success",
                message: "Tokens sent successfully!",
                txHash,
                data: {
                    from: walletAddress,
                    to: recipientAddress,
                    amount: `${dollarAmount} ${sendDenom}`,
                    microUnits: microUnits,
                    denom: sendDenom
                }
            });

            setSuccessMessage(`Successfully sent ${dollarAmount} ${sendDenom.toUpperCase()}!`);
            setSuccessTxHash(txHash);
            setShowSuccessModal(true);
        } catch (error) {
            console.error("❌ sendTokens() failed:", error);
            addResult({
                functionName: "sendTokens()",
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    };

    const testCreateGame = async () => {
        if (!signingClient) {
            addResult({
                functionName: "createGame()",
                status: "error",
                message: "Client not initialized"
            });
            return;
        }

        addResult({
            functionName: "createGame()",
            status: "pending",
            message: "Creating poker game..."
        });

        try {
            // For sit-and-go/tournament games, use single buy-in for both min and max
            const isTournament = isTournamentFormat(gameFormat);

            // Validate and clean all BigInt inputs
            const cleanMinBuyIn = isTournament ? sitAndGoBuyIn.split(".")[0] : minBuyIn.split(".")[0];
            const cleanMaxBuyIn = isTournament ? sitAndGoBuyIn.split(".")[0] : maxBuyIn.split(".")[0];
            const cleanSmallBlind = smallBlind.split(".")[0];
            const cleanBigBlind = bigBlind.split(".")[0];

            if (!cleanMinBuyIn || isNaN(Number(cleanMinBuyIn)) || Number(cleanMinBuyIn) <= 0) {
                throw new Error("Min buy-in must be a positive integer (micro-units)");
            }
            if (!cleanMaxBuyIn || isNaN(Number(cleanMaxBuyIn)) || Number(cleanMaxBuyIn) <= 0) {
                throw new Error("Max buy-in must be a positive integer (micro-units)");
            }
            if (!cleanSmallBlind || isNaN(Number(cleanSmallBlind)) || Number(cleanSmallBlind) <= 0) {
                throw new Error("Small blind must be a positive integer (micro-units)");
            }
            if (!cleanBigBlind || isNaN(Number(cleanBigBlind)) || Number(cleanBigBlind) <= 0) {
                throw new Error("Big blind must be a positive integer (micro-units)");
            }

            const txHash = await signingClient.createGame(
                gameFormat,
                "texas-holdem", // gameVariant - default to texas-holdem for now
                minPlayers,
                maxPlayers,
                BigInt(cleanMinBuyIn),
                BigInt(cleanMaxBuyIn),
                BigInt(cleanSmallBlind),
                BigInt(cleanBigBlind),
                timeout
            );

            addResult({
                functionName: "createGame()",
                status: "success",
                message: "Game created successfully!",
                txHash,
                data: {
                    gameFormat,
                    minPlayers,
                    maxPlayers,
                    minBuyIn,
                    maxBuyIn,
                    smallBlind,
                    bigBlind,
                    timeout
                }
            });
        } catch (error) {
            console.error("❌ createGame() failed:", error);
            addResult({
                functionName: "createGame()",
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    };

    const testJoinGame = async () => {
        if (!signingClient) {
            addResult({
                functionName: "joinGame()",
                status: "error",
                message: "Client not initialized"
            });
            return;
        }

        if (!gameId) {
            addResult({
                functionName: "joinGame()",
                status: "error",
                message: "Please enter game ID"
            });
            return;
        }

        addResult({
            functionName: "joinGame()",
            status: "pending",
            message: `Joining game ${gameId}...`
        });

        try {
            // Validate and clean buy-in amount
            const cleanBuyInAmount = buyInAmount.split(".")[0];
            if (!cleanBuyInAmount || isNaN(Number(cleanBuyInAmount)) || Number(cleanBuyInAmount) <= 0) {
                throw new Error("Buy-in amount must be a positive integer (micro-units)");
            }

            const txHash = await signingClient.joinGame(gameId, seat, BigInt(cleanBuyInAmount));

            addResult({
                functionName: "joinGame()",
                status: "success",
                message: "Joined game successfully!",
                txHash,
                data: { gameId, seat, buyInAmount }
            });
        } catch (error) {
            console.error("❌ joinGame() failed:", error);
            addResult({
                functionName: "joinGame()",
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    };

    const testPerformAction = async () => {
        if (!signingClient) {
            addResult({
                functionName: "performAction()",
                status: "error",
                message: "Client not initialized"
            });
            return;
        }

        if (!gameId) {
            addResult({
                functionName: "performAction()",
                status: "error",
                message: "Please enter game ID"
            });
            return;
        }

        addResult({
            functionName: "performAction()",
            status: "pending",
            message: `Performing action ${action}...`
        });

        try {
            // Validate and clean action amount
            const cleanActionAmount = actionAmount.split(".")[0];
            if (!cleanActionAmount || isNaN(Number(cleanActionAmount)) || Number(cleanActionAmount) < 0) {
                throw new Error("Action amount must be a non-negative integer (micro-units)");
            }

            const txHash = await signingClient.performAction(gameId, action, BigInt(cleanActionAmount));

            addResult({
                functionName: "performAction()",
                status: "success",
                message: "Action performed successfully!",
                txHash,
                data: { gameId, action, amount: actionAmount }
            });
        } catch (error) {
            console.error("❌ performAction() failed:", error);
            addResult({
                functionName: "performAction()",
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    };

    const testQueryGames = async () => {
        if (!signingClient) {
            addResult({
                functionName: "queryGames()",
                status: "error",
                message: "Client not initialized"
            });
            return;
        }

        addResult({
            functionName: "queryGames()",
            status: "pending",
            message: "Querying all games from blockchain..."
        });

        try {
            const games = await signingClient.queryGames();

            addResult({
                functionName: "queryGames()",
                status: "success",
                message: `Found ${games.length} game(s)!`,
                data: { count: games.length, games }
            });
        } catch (error) {
            console.error("❌ queryGames() failed:", error);
            addResult({
                functionName: "queryGames()",
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    };

    const testQueryGameState = async () => {
        if (!signingClient) {
            addResult({
                functionName: "queryGameState()",
                status: "error",
                message: "Client not initialized"
            });
            return;
        }

        if (!gameId) {
            addResult({
                functionName: "queryGameState()",
                status: "error",
                message: "Please enter game ID"
            });
            return;
        }

        addResult({
            functionName: "queryGameState()",
            status: "pending",
            message: `Querying game state for ${gameId}...`
        });

        try {
            const gameState = await signingClient.queryGameState(gameId);

            addResult({
                functionName: "queryGameState()",
                status: "success",
                message: "Game state retrieved!",
                data: {
                    gameId,
                    players: gameState.players?.length || 0,
                    round: gameState.round,
                    actionCount: gameState.actionCount,
                    gameState
                }
            });
        } catch (error) {
            console.error("❌ queryGameState() failed:", error);
            addResult({
                functionName: "queryGameState()",
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error"
            });
        }
    };

    return (
        <div className="min-h-screen bg-surface-page">
            <div className="max-w-[1376px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
                <div>
                    <h1 className="m-0 text-[28px] font-semibold text-ink">Signing Cosmos Client Test Page</h1>
                    <p className="mt-1 mb-0 text-ink-muted">Test all SDK functions from Lucas's Signing Cosmos Client</p>
                </div>

                <div
                    className="p-5 sm:p-6 rounded-2xl mb-6 bg-brand/10 border border-brand/25"
                >
                    <h2 className="m-0 mb-3 text-[17px] font-semibold text-ink">
                        💡 Where Do Test Tokens Come From?
                    </h2>
                    <div className="space-y-3 text-ink-soft text-sm">
                        <div>
                            <span className="font-semibold">You need TWO types of tokens:</span>
                        </div>
                        <div className="ml-4 space-y-2">
                            <div>
                                <span className="font-semibold text-ink">
                                    1. stake
                                </span>{" "}
                                - For gas fees
                                <div className="text-xs text-ink-muted ml-4 mt-1">
                                    • Used to pay for ALL blockchain transactions
                                    <br />
                                    • Without this, your transactions will fail!
                                    <br />
                                    • Get from: Faucet or genesis account
                                    <br />• Note: Local testnet uses 'stake' denomination
                                </div>
                            </div>
                            <div>
                                <span className="font-semibold text-ink">
                                    2. usdc
                                </span>{" "}
                                - For poker games
                                <div className="text-xs text-ink-muted ml-4 mt-1">
                                    • Used for game buy-ins and bets
                                    <br />
                                    • Get from: Bridge deposit from Ethereum or mint via blockchain command
                                    <br />• ⚠️ Note: Use "usdc" denom (not "b52USDC")
                                </div>
                            </div>
                        </div>
                        <div className={`mt-3 p-3 rounded-xl ${styles.infoCommandBox}`}>
                            <div className="font-semibold mb-2">📋 How to Get Test Tokens:</div>
                            <div className="text-xs font-mono space-y-1 text-ink-muted">
                                <div># Option 1: Use genesis account (has tokens by default)</div>
                                <div className="text-ink-muted">pokerchaind keys list</div>
                                <div className="mt-2"># Option 2: Send from another account</div>
                                <div className="text-ink-muted">pokerchaind tx bank send [from] {walletAddress || "[your-address]"} 1000000stake</div>
                                <div className="mt-2"># Option 3: Bridge USDC from Ethereum</div>
                                <div className="text-ink-muted">Use the bridge at /deposit page</div>
                            </div>
                        </div>
                    </div>
                </div>

                {walletAddress && (
                    <div
                        className={`p-5 sm:p-6 rounded-2xl mb-6 ${styles.warningPanel}`}
                    >
                        <h2 className={`m-0 mb-4 text-[17px] font-semibold ${styles.warningTitle}`}>
                            ⚡ Fund from Validator (Recommended for Fresh Testnet)
                        </h2>
                        <div className="space-y-4">
                            <div className="text-sm text-ink-soft">
                                <p className="mb-2">
                                    <strong className="text-ink">Why use the validator account instead of alice/bob/charlie/diana?</strong>
                                </p>
                                <ul className="list-disc ml-5 space-y-1 text-ink-muted">
                                    <li>
                                        The <span className="font-mono text-ink">validator</span> account is created during testnet initialization and gets
                                        funded with tokens automatically
                                    </li>
                                    <li>
                                        Genesis accounts (alice, bob, etc.) are only created if you run <span className="font-mono">ignite chain serve</span>
                                    </li>
                                    <li>
                                        When running <span className="font-mono">run-local-testnet.sh</span>, only the validator exists in the keyring
                                    </li>
                                    <li>
                                        The validator keyring is stored at <span className="font-mono">~/.pokerchain-testnet/node1</span> (not the default
                                        location)
                                    </li>
                                </ul>
                            </div>

                            <div
                                className={`p-4 rounded-xl ${styles.warningCommandBox}`}
                            >
                                <div className="font-semibold text-ink mb-2">📋 Copy this command:</div>
                                <div className="text-xs font-mono text-ink-muted mb-3 break-all">
                                    pokerchaind tx bank send validator {walletAddress} 100000000stake --chain-id pokerchain --keyring-backend test --home
                                    ~/.pokerchain-testnet/node1 --fees 2000stake -y
                                </div>
                                <button
                                    onClick={async () => {
                                        const command = `pokerchaind tx bank send validator ${walletAddress} 100000000stake --chain-id pokerchain --keyring-backend test --home ~/.pokerchain-testnet/node1 --fees 2000stake -y`;
                                        await copyToClipboard(command, "Validator funding command copied. It sends 100 stake to your wallet for gas fees.");
                                    }}
                                    className={`w-full min-h-11 py-2 px-4 text-sm font-semibold rounded-btn transition duration-200 hover:opacity-90 ${styles.warningActionButton}`}
                                >
                                    📋 Copy Validator Funding Command (100 stake for gas)
                                </button>
                            </div>

                            <div
                                className={`p-4 rounded-xl mt-4 ${styles.successCommandBox}`}
                            >
                                <div className="font-semibold text-ink mb-2">⛽ Fund with Stake (Gas Fees Only - For Bridge Testing!):</div>
                                <div className="text-xs font-mono text-ink-muted mb-3 break-all">
                                    pokerchaind tx bank send validator {walletAddress} 100000000stake --chain-id pokerchain --keyring-backend test --home
                                    ~/.pokerchain-testnet/node1 --fees 2000stake -y
                                </div>
                                <button
                                    onClick={async () => {
                                        const command = `pokerchaind tx bank send validator ${walletAddress} 100000000stake --chain-id pokerchain --keyring-backend test --home ~/.pokerchain-testnet/node1 --fees 2000stake -y`;
                                        await copyToClipboard(command, "Stake funding command copied. It sends 100 stake for gas fees. Use the bridge to deposit USDC from Ethereum.");
                                    }}
                                    className={`w-full min-h-11 py-2 px-4 text-sm font-semibold rounded-btn transition duration-200 hover:opacity-90 ${styles.successActionButton}`}
                                >
                                    📋 Copy Stake Funding Command (100 stake for gas)
                                </button>
                                <div className="text-xs text-ink-muted mt-2">
                                    ⛽ Sends ONLY gas tokens - deposit USDC via bridge for real testing!
                                </div>
                            </div>

                            <div
                                className={`p-3 rounded-xl text-xs mt-4 ${styles.keyDiffBox}`}
                            >
                                <div className="font-semibold text-ink mb-2">🔑 Key Differences from Test Accounts Below:</div>
                                <div className="space-y-1 text-ink-muted">
                                    <div>
                                        • <span className="text-ink font-mono">validator</span> instead of <span className="font-mono">alice/bob/etc.</span>
                                    </div>
                                    <div>
                                        • Requires <span className="text-ink font-mono">--home ~/.pokerchain-testnet/node1</span> flag
                                    </div>
                                    <div>
                                        • Only exists when using <span className="font-mono">run-local-testnet.sh</span>
                                    </div>
                                    <div>• Has unlimited tokens (can fund as much as needed)</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {walletAddress && (
                    <div
                        className={`p-5 sm:p-6 rounded-2xl mb-6 ${styles.successPanel}`}
                    >
                        <h2 className={`m-0 mb-4 text-[17px] font-semibold ${styles.successTitle}`}>
                            🏦 Test Accounts - Send Tokens (Only for Ignite Serve)
                        </h2>
                        <div className="text-sm text-ink-soft mb-4">
                            Click "Copy Command" to copy the CLI command, then run it in your terminal where pokerchaind is running.
                        </div>

                        <div
                            className={`mb-4 p-3 rounded-xl text-xs ${styles.commandBreakdownBox}`}
                        >
                            <div className="font-semibold text-ink mb-2">📚 Command Breakdown:</div>
                            <div className="space-y-1 text-ink-muted font-mono">
                                <div>
                                    <span className="text-ink-soft">pokerchaind tx bank send</span> - Send tokens command
                                </div>
                                <div>
                                    <span className="text-ink-soft">[from]</span> - Source account name (alice, bob, etc.)
                                </div>
                                <div>
                                    <span className="text-ink-soft">[to]</span> - Your wallet address (destination)
                                </div>
                                <div>
                                    <span className="text-ink-soft">[amount][denom]</span> - Amount + token type (10000000stake or 50000000usdc)
                                </div>
                                <div>
                                    <span className="text-ink-soft">--chain-id pokerchain</span> - Blockchain network ID
                                </div>
                                <div>
                                    <span className="text-ink-soft">--keyring-backend test</span> - Use test keyring (for development)
                                </div>
                                <div>
                                    <span className="text-ink-soft">-y</span> - Auto-confirm transaction (skip prompt)
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {TEST_ACCOUNTS.map(account => (
                                <div
                                    key={account.address}
                                    className={`p-4 rounded-xl ${styles.accountCard}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-ink capitalize">{account.name}</span>
                                        <span className="text-xs text-ink-muted font-mono">
                                            {account.address.substring(0, 10)}...{account.address.substring(account.address.length - 6)}
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-xs text-ink-muted mb-1 font-mono">
                                                pokerchaind tx bank send {account.name} {walletAddress.substring(0, 10)}... 10000000stake
                                            </div>
                                            <button
                                                onClick={() => copyCommand(account.name, "stake", "10000000")}
                                                className={`w-full min-h-11 py-2 px-3 text-xs font-medium rounded-btn transition duration-200 hover:opacity-80 ${styles.blueCommandButton}`}
                                            >
                                                📋 Copy: Send 10 stake (gas)
                                            </button>
                                        </div>
                                        <div>
                                            <div className="text-xs text-ink-muted mb-1 font-mono">
                                                pokerchaind tx bank send {account.name} {walletAddress.substring(0, 10)}... 50000000usdc
                                            </div>
                                            <button
                                                onClick={() => copyCommand(account.name, "usdc", "50000000")}
                                                className={`w-full min-h-11 py-2 px-3 text-xs font-medium rounded-btn transition duration-200 hover:opacity-80 ${styles.greenCommandButton}`}
                                            >
                                                📋 Copy: Send 50 usdc (poker)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className={`mt-4 p-3 rounded-xl text-xs ${styles.walletAddressBox}`}>
                            <div className="text-ink-muted">
                                <strong className="text-ink">Your address:</strong> <span className="font-mono text-ink-soft">{walletAddress}</span>
                            </div>
                            <div className="text-ink-muted mt-2">After running the command, refresh this page to see your new balance.</div>
                        </div>
                    </div>
                )}

                <div className={`p-5 sm:p-6 rounded-2xl mb-6 ${styles.containerPanel}`}>
                    <h2 className="m-0 mb-4 text-[17px] font-semibold text-ink">1. Initialize Client</h2>
                    {!signingClient ? (
                        <button
                            onClick={initializeClient}
                            disabled={isInitializing}
                            className={`w-full h-12 px-6 text-white text-[15px] font-semibold rounded-btn transition-opacity hover:opacity-90 ${
                                isInitializing ? styles.initializeButtonLoading : styles.initializeButtonReady
                            }`}
                        >
                            {isInitializing ? "Initializing..." : "Initialize SigningCosmosClient"}
                        </button>
                    ) : (
                        <div>
                            <div className="text-emerald-400 font-semibold mb-4">✅ Client Initialized</div>

                            <div
                                className={`mb-4 p-4 rounded-xl ${styles.networkConfigBox}`}
                            >
                                <div className={`text-sm font-semibold mb-2 ${styles.brandPrimaryText}`}>
                                    📡 Connected to: {currentNetwork.name}
                                </div>
                                <div className="space-y-1 text-xs font-mono">
                                    <div className="flex justify-between text-ink-soft">
                                        <span className="text-ink-muted">RPC:</span>
                                        <span className={styles.successText}>{currentNetwork.rpc}</span>
                                    </div>
                                    <div className="flex justify-between text-ink-soft">
                                        <span className="text-ink-muted">REST:</span>
                                        <span className={styles.successText}>{currentNetwork.rest}</span>
                                    </div>
                                    <div className="flex justify-between text-ink-soft">
                                        <span className="text-ink-muted">Chain:</span>
                                        <span className="text-ink">pokerchain</span>
                                    </div>
                                    <div className="flex justify-between text-ink-soft">
                                        <span className="text-ink-muted">Prefix:</span>
                                        <span className="text-ink">b52</span>
                                    </div>
                                    <div className="flex justify-between text-ink-soft">
                                        <span className="text-ink-muted">Gas Denom:</span>
                                        <span className="text-ink">stake</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-ink-soft">
                                    <span className="font-semibold">Address:</span>{" "}
                                    <span className={`font-mono text-sm break-all ${styles.brandPrimaryText}`}>
                                        {walletAddress}
                                    </span>
                                </div>
                                <div className="text-ink-soft">
                                    <span className="font-semibold">Balances:</span>
                                </div>
                                {isEmpty(balances) ? (
                                    <div className="text-amber-300 text-sm ml-4">⚠️ No tokens found - You need tokens to send transactions!</div>
                                ) : (
                                    <div className="ml-4 space-y-2">
                                        {balances.map((balance, idx) => {
                                            // Format balance with proper decimals (6 for micro-denominated tokens)
                                            // Both usdc and stake use 6 decimals (micro-units)
                                            const isMicroDenom = balance.denom === "usdc" || balance.denom === "stake";
                                            const numericAmount = isMicroDenom ? microToUsdc(balance.amount) : Number(balance.amount);

                                            const displayAmount = numericAmount.toLocaleString("en-US", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 6
                                            });

                                            // For usdc, show USD equivalent
                                            const isUSDC = balance.denom === "usdc";
                                            const usdValue = isUSDC
                                                ? numericAmount.toLocaleString("en-US", {
                                                      style: "currency",
                                                      currency: "USD",
                                                      minimumFractionDigits: 2,
                                                      maximumFractionDigits: 2
                                                  })
                                                : null;

                                            return (
                                                <div key={idx} className="text-sm">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className={`font-bold text-lg ${styles.successText}`}>
                                                            {displayAmount}
                                                        </span>
                                                        <span className="text-ink font-medium">{balance.denom}</span>
                                                        {usdValue && <span className="text-ink-muted text-sm">≈ {usdValue}</span>}
                                                    </div>
                                                    {balance.denom !== "stake" && (
                                                        <div className="text-xs text-ink-muted ml-1">
                                                            {Number(balance.amount).toLocaleString("en-US")} micro-units
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {signingClient && (
                    <>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            <div className={`p-5 sm:p-6 rounded-2xl ${styles.containerPanel}`}>
                                <h3 className="m-0 mb-4 text-[17px] font-semibold text-ink">2. getWalletAddress()</h3>
                                <button
                                    onClick={testGetWalletAddress}
                                    className={`w-full h-11 px-5 text-white text-sm font-semibold rounded-btn transition-opacity hover:opacity-90 disabled:opacity-50 ${styles.actionPrimary}`}
                                >
                                    Test Get Wallet Address
                                </button>
                            </div>

                            <div className={`p-5 sm:p-6 rounded-2xl ${styles.containerPanel}`}>
                                <h3 className="m-0 mb-4 text-[17px] font-semibold text-ink">3. sendTokens()</h3>
                                <div className="space-y-3 mb-3">
                                    <div>
                                        <label className="block text-sm text-ink-muted mb-1">Recipient Address</label>
                                        <input
                                            type="text"
                                            placeholder="b521..."
                                            value={recipientAddress}
                                            onChange={e => setRecipientAddress(e.target.value)}
                                            className={`w-full ${styles.inputField}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-ink-muted mb-1">
                                            Amount ({sendDenom.toUpperCase()})
                                            {sendAmount && (
                                                <span className="ml-2 text-xs text-ink-muted">
                                                    = {Math.floor(parseFloat(sendAmount || "0") * USDC_TO_MICRO).toLocaleString()} micro-units
                                                </span>
                                            )}
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="1.00"
                                                value={sendAmount}
                                                onChange={e => setSendAmount(e.target.value)}
                                                className={`flex-1 min-w-[8rem] ${styles.inputField}`}
                                            />
                                            <button
                                                onClick={() => setSendAmount("1")}
                                                className={`min-h-11 px-4 rounded-btn text-sm font-semibold ${styles.amountButtonBlue}`}
                                            >
                                                $1
                                            </button>
                                            <button
                                                onClick={() => setSendAmount("5")}
                                                className={`min-h-11 px-4 rounded-btn text-sm font-semibold ${styles.amountButtonGreen}`}
                                            >
                                                $5
                                            </button>
                                            <button
                                                onClick={() => setSendAmount("10")}
                                                className={`min-h-11 px-4 rounded-btn text-sm font-semibold ${styles.amountButtonGreen}`}
                                            >
                                                $10
                                            </button>
                                        </div>
                                        <p className="text-xs text-ink-muted mt-2">
                                            💡 Enter dollar amount (1, 5, 0.01, etc.) - Converts to micro-units automatically
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-ink-muted mb-1">Token Type</label>
                                        <select
                                            value={sendDenom}
                                            onChange={e => setSendDenom(e.target.value)}
                                            className={`w-full ${styles.inputField}`}
                                        >
                                            <option value="usdc">usdc (poker tokens)</option>
                                            <option value="stake">stake (gas tokens)</option>
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onClick={testSendTokens}
                                    className={`w-full h-11 px-5 text-white text-sm font-semibold rounded-btn transition-opacity hover:opacity-90 disabled:opacity-50 ${styles.actionSuccess}`}
                                >
                                    Test Send Tokens
                                </button>
                            </div>
                        </div>

                        <div className={`p-5 sm:p-6 rounded-2xl mb-6 ${styles.containerPanel}`}>
                            <h3 className="m-0 mb-4 text-[17px] font-semibold text-ink">4. createGame()</h3>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="col-span-2">
                                    <label className="block text-sm text-ink-muted mb-1">Game Format</label>
                                    <select
                                        value={gameFormat}
                                        onChange={e => {
                                            const format = toGameFormat(e.target.value);
                                            if (format) setGameFormat(format);
                                        }}
                                        className={`w-full ${styles.inputField}`}
                                    >
                                        <option value={GameFormat.SIT_AND_GO}>Sit & Go</option>
                                        <option value={GameFormat.CASH}>Cash Game</option>
                                        <option value={GameFormat.TOURNAMENT}>Tournament</option>
                                    </select>
                                </div>
                                <input
                                    type="number"
                                    placeholder="Timeout (seconds)"
                                    value={timeout}
                                    onChange={e => setTimeout(Number(e.target.value))}
                                    className={`${styles.inputField}`}
                                />
                                <input
                                    type="number"
                                    placeholder="Min Players"
                                    value={minPlayers}
                                    onChange={e => setMinPlayers(Number(e.target.value))}
                                    className={`${styles.inputField}`}
                                />
                                <input
                                    type="number"
                                    placeholder="Max Players"
                                    value={maxPlayers}
                                    onChange={e => setMaxPlayers(Number(e.target.value))}
                                    className={`${styles.inputField}`}
                                />

                                {isTournamentFormat(gameFormat) ? (
                                    // Sit & Go / Tournament: single buy-in
                                    <div className="col-span-2">
                                        <label className="block text-sm text-ink-muted mb-1">Tournament Buy-In (usdc micro-units)</label>
                                        <input
                                            type="text"
                                            placeholder="10000000"
                                            value={sitAndGoBuyIn}
                                            onChange={e => setSitAndGoBuyIn(e.target.value)}
                                            className={`w-full ${styles.inputField}`}
                                        />
                                        <p className="text-xs text-ink-muted mt-1">10,000,000 = 10 usdc (your balance: 50 usdc)</p>
                                    </div>
                                ) : (
                                    // Cash Game: min/max buy-in range
                                    <>
                                        <input
                                            type="text"
                                            placeholder="Min Buy-In"
                                            value={minBuyIn}
                                            onChange={e => setMinBuyIn(e.target.value)}
                                            className={`${styles.inputField}`}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Max Buy-In"
                                            value={maxBuyIn}
                                            onChange={e => setMaxBuyIn(e.target.value)}
                                            className={`${styles.inputField}`}
                                        />
                                    </>
                                )}

                                <div>
                                    <label className="block text-sm text-ink-muted mb-1">Small Blind (usdc micro-units)</label>
                                    <input
                                        type="text"
                                        placeholder="100000"
                                        value={smallBlind}
                                        onChange={e => setSmallBlind(e.target.value)}
                                        className={`w-full ${styles.inputField}`}
                                    />
                                    <p className="text-xs text-ink-muted mt-1">100,000 = 0.1 usdc</p>
                                </div>
                                <div>
                                    <label className="block text-sm text-ink-muted mb-1">Big Blind (usdc micro-units)</label>
                                    <input
                                        type="text"
                                        placeholder="200000"
                                        value={bigBlind}
                                        onChange={e => setBigBlind(e.target.value)}
                                        className={`w-full ${styles.inputField}`}
                                    />
                                    <p className="text-xs text-ink-muted mt-1">200,000 = 0.2 usdc</p>
                                </div>
                            </div>
                            <button
                                onClick={testCreateGame}
                                className={`w-full h-11 px-5 text-white text-sm font-semibold rounded-btn transition-opacity hover:opacity-90 disabled:opacity-50 ${styles.actionPrimary}`}
                            >
                                Test Create Game
                            </button>
                        </div>

                        <div className={`p-5 sm:p-6 rounded-2xl mb-6 ${styles.containerPanel}`}>
                            <h3 className="m-0 mb-4 text-[17px] font-semibold text-ink">5. joinGame()</h3>
                            <div className="space-y-3 mb-3">
                                <div>
                                    <label className="block text-sm text-ink-muted mb-1">Game ID (from createGame transaction)</label>
                                    <input
                                        type="text"
                                        placeholder="0x645d17cae33d8832e38cb16639983d2239631356d60e3656d54036f7792b13ed"
                                        value={gameId}
                                        onChange={e => setGameId(e.target.value)}
                                        className={`w-full ${styles.inputField}`}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm text-ink-muted mb-1">Seat Number (0-5)</label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={seat}
                                            onChange={e => setSeat(Number(e.target.value))}
                                            className={`w-full ${styles.inputField}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-ink-muted mb-1">Buy-In Amount (usdc micro-units)</label>
                                        <input
                                            type="text"
                                            placeholder="10000000"
                                            value={buyInAmount}
                                            onChange={e => setBuyInAmount(e.target.value)}
                                            className={`w-full ${styles.inputField}`}
                                        />
                                        <p className="text-xs text-ink-muted mt-1">10,000,000 = 10 usdc (must match game's buy-in)</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={testJoinGame}
                                className={`w-full h-11 px-5 text-white text-sm font-semibold rounded-btn transition-opacity hover:opacity-90 disabled:opacity-50 ${styles.actionSuccess}`}
                            >
                                Test Join Game
                            </button>
                        </div>

                        <div className={`p-5 sm:p-6 rounded-2xl mb-6 ${styles.containerPanel}`}>
                            <h3 className="m-0 mb-4 text-[17px] font-semibold text-ink">6. performAction()</h3>
                            <div className="space-y-3 mb-3">
                                <div>
                                    <label className="block text-sm text-ink-muted mb-1">Game ID (same as joinGame)</label>
                                    <input
                                        type="text"
                                        placeholder="0x645d17cae33d8832e38cb16639983d2239631356d60e3656d54036f7792b13ed"
                                        value={gameId}
                                        onChange={e => setGameId(e.target.value)}
                                        className={`w-full ${styles.inputField}`}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm text-ink-muted mb-1">Action Type</label>
                                        <select
                                            value={action}
                                            onChange={e => setAction(e.target.value)}
                                            className={`w-full ${styles.inputField}`}
                                        >
                                            <option value="fold">Fold</option>
                                            <option value="call">Call</option>
                                            <option value="raise">Raise</option>
                                            <option value="bet">Bet</option>
                                            <option value="check">Check</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-ink-muted mb-1">Amount (0 for fold/check)</label>
                                        <input
                                            type="text"
                                            placeholder="0"
                                            value={actionAmount}
                                            onChange={e => setActionAmount(e.target.value)}
                                            className={`w-full ${styles.inputField}`}
                                        />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={testPerformAction}
                                className={`w-full h-11 px-5 text-sm font-semibold rounded-btn transition-opacity hover:opacity-90 disabled:opacity-50 ${styles.actionWithdraw}`}
                            >
                                Test Perform Action
                            </button>
                        </div>

                        <div className={`p-5 sm:p-6 rounded-2xl mb-6 ${styles.containerPanel}`}>
                            <h3 className="m-0 mb-4 text-[17px] font-semibold text-ink">7. queryGames()</h3>
                            <p className="text-ink-muted text-sm mb-4">Query all games from the blockchain</p>
                            <button
                                onClick={testQueryGames}
                                className={`w-full h-11 px-5 text-white text-sm font-semibold rounded-btn transition-opacity hover:opacity-90 disabled:opacity-50 ${styles.actionPrimary}`}
                            >
                                Test Query Games
                            </button>
                        </div>

                        <div className={`p-5 sm:p-6 rounded-2xl mb-6 ${styles.containerPanel}`}>
                            <h3 className="m-0 mb-4 text-[17px] font-semibold text-ink">8. queryGameState()</h3>
                            <div className="space-y-3 mb-3">
                                <div>
                                    <label className="block text-sm text-ink-muted mb-1">Game ID (from createGame or list)</label>
                                    <input
                                        type="text"
                                        placeholder="0x..."
                                        value={gameId}
                                        onChange={e => setGameId(e.target.value)}
                                        className={`w-full ${styles.inputField}`}
                                    />
                                    <p className="text-xs text-ink-muted mt-1">Same Game ID used above</p>
                                </div>
                            </div>
                            <button
                                onClick={testQueryGameState}
                                className={`w-full h-11 px-5 text-white text-sm font-semibold rounded-btn transition-opacity hover:opacity-90 disabled:opacity-50 ${styles.actionPrimary}`}
                            >
                                Test Query Game State
                            </button>
                        </div>
                    </>
                )}

                <div className={`p-5 sm:p-6 rounded-2xl ${styles.containerPanel}`}>
                    <h2 className="m-0 mb-4 text-[17px] font-semibold text-ink">Test Results</h2>
                    {isEmpty(testResults) ? (
                        <p className="text-ink-muted">No tests run yet</p>
                    ) : (
                        <div className="space-y-3">
                            {testResults.map((result, index) => (
                                <div
                                    key={index}
                                    className={`p-4 rounded-xl ${styles.testResultCard} ${
                                        result.status === "success"
                                            ? styles.testResultSuccess
                                            : result.status === "error"
                                            ? styles.testResultError
                                            : styles.testResultPending
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <span className={`font-mono text-sm break-all ${styles.brandPrimaryText}`}>
                                            {result.functionName}
                                        </span>
                                        <span
                                            className={`text-xs font-bold ${
                                                result.status === "success" ? "text-emerald-400" : result.status === "error" ? "text-red-400" : "text-amber-300"
                                            }`}
                                        >
                                            {result.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="text-ink-soft text-sm mb-2">{result.message}</p>
                                    {result.txHash && <p className="text-xs font-mono text-ink-muted">Tx: {result.txHash}</p>}
                                    {result.data && <pre className="text-xs text-ink-muted mt-2 overflow-auto">{JSON.stringify(result.data, null, 2)}</pre>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {showSuccessModal && successTxHash && (
                    <Modal
                        isOpen
                        onClose={() => {
                            setShowSuccessModal(false);
                            setSuccessTxHash(null);
                        }}
                        title="Transaction Successful!"
                        widthClass="w-[32rem]"
                    >
                        <p className="m-0 mb-4 text-ink-soft text-sm">{successMessage}</p>

                        <div className="px-4 py-3 rounded-xl bg-surface-raised border border-line mb-6">
                            <p className="m-0 mb-2 text-xs uppercase tracking-[0.08em] text-ink-muted">Transaction Hash</p>
                            <div className="flex items-center justify-between gap-2">
                                <code className="text-emerald-400 text-xs font-mono break-all">{successTxHash}</code>
                                <button
                                    type="button"
                                    onClick={() => copyToClipboard(successTxHash, "Transaction hash copied")}
                                    className="shrink-0 w-11 h-11 sm:w-9 sm:h-9 grid place-items-center rounded-btn text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
                                    title="Copy transaction hash"
                                    aria-label="Copy transaction hash"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <PillLink to={`/explorer/tx/${successTxHash}`} variant="primary" size="lg" className="flex-1">
                                View on Explorer
                            </PillLink>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    setSuccessTxHash(null);
                                }}
                                className="flex-1 h-12 px-6 rounded-btn border border-line-strong text-ink font-semibold text-[15px] hover:bg-ink hover:text-surface-page hover:border-ink transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </Modal>
                )}
            </div>
        </div>
    );
}
