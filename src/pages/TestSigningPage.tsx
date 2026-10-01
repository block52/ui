import React, { useState } from "react";
import { Link } from "react-router-dom";
import { SigningCosmosClient, GameFormat } from "@block52/poker-vm-sdk";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { getCosmosMnemonic } from "../utils/cosmos/storage";
import { useNetwork } from "../context/NetworkContext";
import { USDC_TO_MICRO, microToUsdc } from "../constants/currency";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { isEmpty } from "../utils/guards";
import { isTournamentFormat, toGameFormat } from "../utils/gameFormatUtils";
import styles from "./TestSigningPage.module.css";

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

    // Success modal state
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string>("");

    // Test inputs
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

    const copyCommand = (account: string, denom: string, amount: string) => {
        const command = `pokerchaind tx bank send ${account} ${walletAddress} ${amount}${denom} --chain-id pokerchain --keyring-backend test -y`;
        navigator.clipboard.writeText(command);
        alert(`Command copied to clipboard!\n\n${command}`);
    };

    // Auto-initialize client on page load
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
            // Get mnemonic from storage
            const mnemonic = getCosmosMnemonic();
            if (!mnemonic) {
                throw new Error("No mnemonic found. Please create a wallet first at /wallet");
            }

            // Create wallet from mnemonic
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

            // Fetch balances
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

            // Show success modal
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
        <div className="min-h-screen flex flex-col items-center relative overflow-hidden p-6">
            <AnimatedBackground />
            <div className="w-full max-w-5xl relative z-10">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-4xl font-extrabold text-white mb-2 text-center">Signing Cosmos Client Test Page</h1>
                    <p className="text-gray-300 text-center">Test all SDK functions from Lucas's Signing Cosmos Client</p>
                </div>

                {/* Token Info Section */}
                <div
                    className="backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 bg-blue-900/20 border border-blue-700"
                >
                    <h2 className="text-xl font-bold text-white mb-3">
                        💡 Where Do Test Tokens Come From?
                    </h2>
                    <div className="space-y-3 text-gray-300 text-sm">
                        <div>
                            <span className="font-semibold">You need TWO types of tokens:</span>
                        </div>
                        <div className="ml-4 space-y-2">
                            <div>
                                <span className="font-semibold text-white">
                                    1. stake
                                </span>{" "}
                                - For gas fees
                                <div className="text-xs text-gray-400 ml-4 mt-1">
                                    • Used to pay for ALL blockchain transactions
                                    <br />
                                    • Without this, your transactions will fail!
                                    <br />
                                    • Get from: Faucet or genesis account
                                    <br />• Note: Local testnet uses 'stake' denomination
                                </div>
                            </div>
                            <div>
                                <span className="font-semibold text-white">
                                    2. usdc
                                </span>{" "}
                                - For poker games
                                <div className="text-xs text-gray-400 ml-4 mt-1">
                                    • Used for game buy-ins and bets
                                    <br />
                                    • Get from: Bridge deposit from Ethereum or mint via blockchain command
                                    <br />• ⚠️ Note: Use "usdc" denom (not "b52USDC")
                                </div>
                            </div>
                        </div>
                        <div className={`mt-3 p-3 rounded ${styles.infoCommandBox}`}>
                            <div className="font-semibold mb-2">📋 How to Get Test Tokens:</div>
                            <div className="text-xs font-mono space-y-1 text-gray-400">
                                <div># Option 1: Use genesis account (has tokens by default)</div>
                                <div className="text-gray-500">pokerchaind keys list</div>
                                <div className="mt-2"># Option 2: Send from another account</div>
                                <div className="text-gray-500">pokerchaind tx bank send [from] {walletAddress || "[your-address]"} 1000000stake</div>
                                <div className="mt-2"># Option 3: Bridge USDC from Ethereum</div>
                                <div className="text-gray-500">Use the bridge at /deposit page</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Validator Funding Section - Primary Method for Fresh Testnet */}
                {walletAddress && (
                    <div
                        className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.warningPanel}`}
                    >
                        <h2 className={`text-2xl font-bold mb-4 ${styles.warningTitle}`}>
                            ⚡ Fund from Validator (Recommended for Fresh Testnet)
                        </h2>
                        <div className="space-y-4">
                            <div className="text-sm text-gray-300">
                                <p className="mb-2">
                                    <strong className="text-white">Why use the validator account instead of alice/bob/charlie/diana?</strong>
                                </p>
                                <ul className="list-disc ml-5 space-y-1 text-gray-400">
                                    <li>
                                        The <span className="font-mono text-white">validator</span> account is created during testnet initialization and gets
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
                                className={`p-4 rounded-lg ${styles.warningCommandBox}`}
                            >
                                <div className="font-semibold text-white mb-2">📋 Copy this command:</div>
                                <div className="text-xs font-mono text-gray-400 mb-3 break-all">
                                    pokerchaind tx bank send validator {walletAddress} 100000000stake --chain-id pokerchain --keyring-backend test --home
                                    ~/.pokerchain-testnet/node1 --fees 2000stake -y
                                </div>
                                <button
                                    onClick={() => {
                                        const command = `pokerchaind tx bank send validator ${walletAddress} 100000000stake --chain-id pokerchain --keyring-backend test --home ~/.pokerchain-testnet/node1 --fees 2000stake -y`;
                                        navigator.clipboard.writeText(command);
                                        alert(`Validator funding command copied!\n\nThis will send 100 stake to your wallet for gas fees.\n\n${command}`);
                                    }}
                                    className={`w-full py-3 px-4 text-sm font-semibold rounded-lg transition duration-200 hover:opacity-90 active:scale-95 ${styles.warningActionButton}`}
                                >
                                    📋 Copy Validator Funding Command (100 stake for gas)
                                </button>
                            </div>

                            {/* Stake only command (for bridge testing) */}
                            <div
                                className={`p-4 rounded-lg mt-4 ${styles.successCommandBox}`}
                            >
                                <div className="font-semibold text-white mb-2">⛽ Fund with Stake (Gas Fees Only - For Bridge Testing!):</div>
                                <div className="text-xs font-mono text-gray-400 mb-3 break-all">
                                    pokerchaind tx bank send validator {walletAddress} 100000000stake --chain-id pokerchain --keyring-backend test --home
                                    ~/.pokerchain-testnet/node1 --fees 2000stake -y
                                </div>
                                <button
                                    onClick={() => {
                                        const command = `pokerchaind tx bank send validator ${walletAddress} 100000000stake --chain-id pokerchain --keyring-backend test --home ~/.pokerchain-testnet/node1 --fees 2000stake -y`;
                                        navigator.clipboard.writeText(command);
                                        alert(`Stake funding command copied!\n\nThis will send:\n• 100 stake (for gas fees)\n\nUse bridge to deposit USDC from Ethereum!\n\n${command}`);
                                    }}
                                    className={`w-full py-3 px-4 text-sm font-semibold rounded-lg transition duration-200 hover:opacity-90 active:scale-95 ${styles.successActionButton}`}
                                >
                                    📋 Copy Stake Funding Command (100 stake for gas)
                                </button>
                                <div className="text-xs text-gray-400 mt-2">
                                    ⛽ Sends ONLY gas tokens - deposit USDC via bridge for real testing!
                                </div>
                            </div>

                            <div
                                className={`p-3 rounded text-xs mt-4 ${styles.keyDiffBox}`}
                            >
                                <div className="font-semibold text-white mb-2">🔑 Key Differences from Test Accounts Below:</div>
                                <div className="space-y-1 text-gray-400">
                                    <div>
                                        • <span className="text-white font-mono">validator</span> instead of <span className="font-mono">alice/bob/etc.</span>
                                    </div>
                                    <div>
                                        • Requires <span className="text-white font-mono">--home ~/.pokerchain-testnet/node1</span> flag
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

                {/* Test Accounts Section */}
                {walletAddress && (
                    <div
                        className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.successPanel}`}
                    >
                        <h2 className={`text-xl font-bold mb-4 ${styles.successTitle}`}>
                            🏦 Test Accounts - Send Tokens (Only for Ignite Serve)
                        </h2>
                        <div className="text-sm text-gray-300 mb-4">
                            Click "Copy Command" to copy the CLI command, then run it in your terminal where pokerchaind is running.
                        </div>

                        {/* Command Explanation */}
                        <div
                            className={`mb-4 p-3 rounded text-xs ${styles.commandBreakdownBox}`}
                        >
                            <div className="font-semibold text-white mb-2">📚 Command Breakdown:</div>
                            <div className="space-y-1 text-gray-400 font-mono">
                                <div>
                                    <span className="text-gray-300">pokerchaind tx bank send</span> - Send tokens command
                                </div>
                                <div>
                                    <span className="text-gray-300">[from]</span> - Source account name (alice, bob, etc.)
                                </div>
                                <div>
                                    <span className="text-gray-300">[to]</span> - Your wallet address (destination)
                                </div>
                                <div>
                                    <span className="text-gray-300">[amount][denom]</span> - Amount + token type (10000000stake or 50000000usdc)
                                </div>
                                <div>
                                    <span className="text-gray-300">--chain-id pokerchain</span> - Blockchain network ID
                                </div>
                                <div>
                                    <span className="text-gray-300">--keyring-backend test</span> - Use test keyring (for development)
                                </div>
                                <div>
                                    <span className="text-gray-300">-y</span> - Auto-confirm transaction (skip prompt)
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {TEST_ACCOUNTS.map(account => (
                                <div
                                    key={account.address}
                                    className={`p-4 rounded-lg ${styles.accountCard}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-white capitalize">{account.name}</span>
                                        <span className="text-xs text-gray-400 font-mono">
                                            {account.address.substring(0, 10)}...{account.address.substring(account.address.length - 6)}
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {/* stake command */}
                                        <div>
                                            <div className="text-xs text-gray-400 mb-1 font-mono">
                                                pokerchaind tx bank send {account.name} {walletAddress.substring(0, 10)}... 10000000stake
                                            </div>
                                            <button
                                                onClick={() => copyCommand(account.name, "stake", "10000000")}
                                                className={`w-full py-2 px-3 text-xs font-medium rounded transition duration-200 hover:opacity-80 ${styles.blueCommandButton}`}
                                            >
                                                📋 Copy: Send 10 stake (gas)
                                            </button>
                                        </div>
                                        {/* usdc command */}
                                        <div>
                                            <div className="text-xs text-gray-400 mb-1 font-mono">
                                                pokerchaind tx bank send {account.name} {walletAddress.substring(0, 10)}... 50000000usdc
                                            </div>
                                            <button
                                                onClick={() => copyCommand(account.name, "usdc", "50000000")}
                                                className={`w-full py-2 px-3 text-xs font-medium rounded transition duration-200 hover:opacity-80 ${styles.greenCommandButton}`}
                                            >
                                                📋 Copy: Send 50 usdc (poker)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className={`mt-4 p-3 rounded text-xs ${styles.walletAddressBox}`}>
                            <div className="text-gray-400">
                                <strong className="text-white">Your address:</strong> <span className="font-mono text-gray-300">{walletAddress}</span>
                            </div>
                            <div className="text-gray-500 mt-2">After running the command, refresh this page to see your new balance.</div>
                        </div>
                    </div>
                )}

                {/* Initialization Section */}
                <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.containerPanel}`}>
                    <h2 className="text-2xl font-bold text-white mb-4">1. Initialize Client</h2>
                    {!signingClient ? (
                        <button
                            onClick={initializeClient}
                            disabled={isInitializing}
                            className={`w-full py-3 px-6 text-white font-bold rounded-lg transition duration-300 shadow-md ${
                                isInitializing ? styles.initializeButtonLoading : styles.initializeButtonReady
                            }`}
                        >
                            {isInitializing ? "Initializing..." : "Initialize SigningCosmosClient"}
                        </button>
                    ) : (
                        <div>
                            <div className="text-green-400 font-semibold mb-4">✅ Client Initialized</div>

                            {/* Configuration Display */}
                            <div
                                className={`mb-4 p-4 rounded-lg ${styles.networkConfigBox}`}
                            >
                                <div className={`text-sm font-semibold mb-2 ${styles.brandPrimaryText}`}>
                                    📡 Connected to: {currentNetwork.name}
                                </div>
                                <div className="space-y-1 text-xs font-mono">
                                    <div className="flex justify-between text-gray-300">
                                        <span className="text-gray-400">RPC:</span>
                                        <span className={styles.successText}>{currentNetwork.rpc}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-300">
                                        <span className="text-gray-400">REST:</span>
                                        <span className={styles.successText}>{currentNetwork.rest}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-300">
                                        <span className="text-gray-400">Chain:</span>
                                        <span className="text-white">pokerchain</span>
                                    </div>
                                    <div className="flex justify-between text-gray-300">
                                        <span className="text-gray-400">Prefix:</span>
                                        <span className="text-white">b52</span>
                                    </div>
                                    <div className="flex justify-between text-gray-300">
                                        <span className="text-gray-400">Gas Denom:</span>
                                        <span className="text-white">stake</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-gray-300">
                                    <span className="font-semibold">Address:</span>{" "}
                                    <span className={`font-mono text-sm ${styles.brandPrimaryText}`}>
                                        {walletAddress}
                                    </span>
                                </div>
                                <div className="text-gray-300">
                                    <span className="font-semibold">Balances:</span>
                                </div>
                                {isEmpty(balances) ? (
                                    <div className="text-yellow-400 text-sm ml-4">⚠️ No tokens found - You need tokens to send transactions!</div>
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
                                                        <span className="text-white font-medium">{balance.denom}</span>
                                                        {usdValue && <span className="text-gray-400 text-sm">≈ {usdValue}</span>}
                                                    </div>
                                                    {balance.denom !== "stake" && (
                                                        <div className="text-xs text-gray-500 ml-1">
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
                        {/* Test Sections */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* getWalletAddress() */}
                            <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl ${styles.containerPanel}`}>
                                <h3 className="text-xl font-bold text-white mb-4">2. getWalletAddress()</h3>
                                <button
                                    onClick={testGetWalletAddress}
                                    className={`w-full py-2 px-4 text-white font-bold rounded-lg ${styles.actionPrimary}`}
                                >
                                    Test Get Wallet Address
                                </button>
                            </div>

                            {/* sendTokens() */}
                            <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl ${styles.containerPanel}`}>
                                <h3 className="text-xl font-bold text-white mb-4">3. sendTokens()</h3>
                                <div className="space-y-3 mb-3">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Recipient Address</label>
                                        <input
                                            type="text"
                                            placeholder="b521..."
                                            value={recipientAddress}
                                            onChange={e => setRecipientAddress(e.target.value)}
                                            className={`w-full p-2 rounded-lg text-white ${styles.inputField}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">
                                            Amount ({sendDenom.toUpperCase()})
                                            {sendAmount && (
                                                <span className="ml-2 text-xs text-gray-500">
                                                    = {Math.floor(parseFloat(sendAmount || "0") * USDC_TO_MICRO).toLocaleString()} micro-units
                                                </span>
                                            )}
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="1.00"
                                                value={sendAmount}
                                                onChange={e => setSendAmount(e.target.value)}
                                                className={`flex-1 p-2 rounded-lg text-white ${styles.inputField}`}
                                            />
                                            <button
                                                onClick={() => setSendAmount("1")}
                                                className={`px-4 py-2 rounded-lg text-sm font-semibold ${styles.amountButtonBlue}`}
                                            >
                                                $1
                                            </button>
                                            <button
                                                onClick={() => setSendAmount("5")}
                                                className={`px-4 py-2 rounded-lg text-sm font-semibold ${styles.amountButtonGreen}`}
                                            >
                                                $5
                                            </button>
                                            <button
                                                onClick={() => setSendAmount("10")}
                                                className={`px-4 py-2 rounded-lg text-sm font-semibold ${styles.amountButtonGreen}`}
                                            >
                                                $10
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            💡 Enter dollar amount (1, 5, 0.01, etc.) - Converts to micro-units automatically
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Token Type</label>
                                        <select
                                            value={sendDenom}
                                            onChange={e => setSendDenom(e.target.value)}
                                            className={`w-full p-2 rounded-lg text-white ${styles.inputField}`}
                                        >
                                            <option value="usdc">usdc (poker tokens)</option>
                                            <option value="stake">stake (gas tokens)</option>
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onClick={testSendTokens}
                                    className={`w-full py-2 px-4 text-white font-bold rounded-lg ${styles.actionSuccess}`}
                                >
                                    Test Send Tokens
                                </button>
                            </div>
                        </div>

                        {/* createGame() */}
                        <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.containerPanel}`}>
                            <h3 className="text-xl font-bold text-white mb-4">4. createGame()</h3>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="col-span-2">
                                    <label className="block text-sm text-gray-400 mb-1">Game Format</label>
                                    <select
                                        value={gameFormat}
                                        onChange={e => {
                                            const format = toGameFormat(e.target.value);
                                            if (format) setGameFormat(format);
                                        }}
                                        className={`w-full p-2 rounded-lg text-white ${styles.inputField}`}
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
                                    className={`p-2 rounded-lg text-white ${styles.inputField}`}
                                />
                                <input
                                    type="number"
                                    placeholder="Min Players"
                                    value={minPlayers}
                                    onChange={e => setMinPlayers(Number(e.target.value))}
                                    className={`p-2 rounded-lg text-white ${styles.inputField}`}
                                />
                                <input
                                    type="number"
                                    placeholder="Max Players"
                                    value={maxPlayers}
                                    onChange={e => setMaxPlayers(Number(e.target.value))}
                                    className={`p-2 rounded-lg text-white ${styles.inputField}`}
                                />

                                {/* Conditional rendering based on game format */}
                                {isTournamentFormat(gameFormat) ? (
                                    // Sit & Go / Tournament: single buy-in
                                    <div className="col-span-2">
                                        <label className="block text-sm text-gray-400 mb-1">Tournament Buy-In (usdc micro-units)</label>
                                        <input
                                            type="text"
                                            placeholder="10000000"
                                            value={sitAndGoBuyIn}
                                            onChange={e => setSitAndGoBuyIn(e.target.value)}
                                            className={`w-full p-2 rounded-lg text-white ${styles.inputField}`}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">10,000,000 = 10 usdc (your balance: 50 usdc)</p>
                                    </div>
                                ) : (
                                    // Cash Game: min/max buy-in range
                                    <>
                                        <input
                                            type="text"
                                            placeholder="Min Buy-In"
                                            value={minBuyIn}
                                            onChange={e => setMinBuyIn(e.target.value)}
                                            className={`p-2 rounded-lg text-white ${styles.inputField}`}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Max Buy-In"
                                            value={maxBuyIn}
                                            onChange={e => setMaxBuyIn(e.target.value)}
                                            className={`p-2 rounded-lg text-white ${styles.inputField}`}
                                        />
                                    </>
                                )}

                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Small Blind (usdc micro-units)</label>
                                    <input
                                        type="text"
                                        placeholder="100000"
                                        value={smallBlind}
                                        onChange={e => setSmallBlind(e.target.value)}
                                        className={`w-full p-2 rounded-lg text-white ${styles.inputField}`}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">100,000 = 0.1 usdc</p>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Big Blind (usdc micro-units)</label>
                                    <input
                                        type="text"
                                        placeholder="200000"
                                        value={bigBlind}
                                        onChange={e => setBigBlind(e.target.value)}
                                        className={`w-full p-2 rounded-lg text-white ${styles.inputField}`}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">200,000 = 0.2 usdc</p>
                                </div>
                            </div>
                            <button
                                onClick={testCreateGame}
                                className={`w-full py-2 px-4 text-white font-bold rounded-lg ${styles.actionPrimary}`}
                            >
                                Test Create Game
                            </button>
                        </div>

                        {/* joinGame() */}
                        <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.containerPanel}`}>
                            <h3 className="text-xl font-bold text-white mb-4">5. joinGame()</h3>
                            <div className="space-y-3 mb-3">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Game ID (from createGame transaction)</label>
                                    <input
                                        type="text"
                                        placeholder="0x645d17cae33d8832e38cb16639983d2239631356d60e3656d54036f7792b13ed"
                                        value={gameId}
                                        onChange={e => setGameId(e.target.value)}
                                        className={`w-full p-2 rounded-lg text-white ${styles.inputField}`}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Seat Number (0-5)</label>
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={seat}
                                            onChange={e => setSeat(Number(e.target.value))}
                                            className={`w-full p-2 rounded-lg text-white ${styles.inputField}`}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Buy-In Amount (usdc micro-units)</label>
                                        <input
                                            type="text"
                                            placeholder="10000000"
                                            value={buyInAmount}
                                            onChange={e => setBuyInAmount(e.target.value)}
                                            className={`w-full p-2 rounded-lg text-white ${styles.inputField}`}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">10,000,000 = 10 usdc (must match game's buy-in)</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={testJoinGame}
                                className={`w-full py-2 px-4 text-white font-bold rounded-lg ${styles.actionSuccess}`}
                            >
                                Test Join Game
                            </button>
                        </div>

                        {/* performAction() */}
                        <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.containerPanel}`}>
                            <h3 className="text-xl font-bold text-white mb-4">6. performAction()</h3>
                            <div className="space-y-3 mb-3">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Game ID (same as joinGame)</label>
                                    <input
                                        type="text"
                                        placeholder="0x645d17cae33d8832e38cb16639983d2239631356d60e3656d54036f7792b13ed"
                                        value={gameId}
                                        onChange={e => setGameId(e.target.value)}
                                        className={`w-full p-2 rounded-lg text-white ${styles.inputField}`}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Action Type</label>
                                        <select
                                            value={action}
                                            onChange={e => setAction(e.target.value)}
                                            className={`w-full p-2 rounded-lg text-white ${styles.inputField}`}
                                        >
                                            <option value="fold">Fold</option>
                                            <option value="call">Call</option>
                                            <option value="raise">Raise</option>
                                            <option value="bet">Bet</option>
                                            <option value="check">Check</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Amount (0 for fold/check)</label>
                                        <input
                                            type="text"
                                            placeholder="0"
                                            value={actionAmount}
                                            onChange={e => setActionAmount(e.target.value)}
                                            className={`w-full p-2 rounded-lg text-white ${styles.inputField}`}
                                        />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={testPerformAction}
                                className={`w-full py-2 px-4 text-white font-bold rounded-lg ${styles.actionWithdraw}`}
                            >
                                Test Perform Action
                            </button>
                        </div>

                        {/* queryGames() */}
                        <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.containerPanel}`}>
                            <h3 className="text-xl font-bold text-white mb-4">7. queryGames()</h3>
                            <p className="text-gray-400 text-sm mb-4">Query all games from the blockchain</p>
                            <button
                                onClick={testQueryGames}
                                className={`w-full py-2 px-4 text-white font-bold rounded-lg ${styles.actionPrimary}`}
                            >
                                Test Query Games
                            </button>
                        </div>

                        {/* queryGameState() */}
                        <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl mb-6 ${styles.containerPanel}`}>
                            <h3 className="text-xl font-bold text-white mb-4">8. queryGameState()</h3>
                            <div className="space-y-3 mb-3">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Game ID (from createGame or list)</label>
                                    <input
                                        type="text"
                                        placeholder="0x..."
                                        value={gameId}
                                        onChange={e => setGameId(e.target.value)}
                                        className={`w-full p-2 rounded-lg text-white ${styles.inputField}`}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Same Game ID used above</p>
                                </div>
                            </div>
                            <button
                                onClick={testQueryGameState}
                                className={`w-full py-2 px-4 text-white font-bold rounded-lg ${styles.actionPrimary}`}
                            >
                                Test Query Game State
                            </button>
                        </div>
                    </>
                )}

                {/* Test Results */}
                <div className={`backdrop-blur-md p-6 rounded-xl shadow-2xl ${styles.containerPanel}`}>
                    <h2 className="text-2xl font-bold text-white mb-4">Test Results</h2>
                    {isEmpty(testResults) ? (
                        <p className="text-gray-400">No tests run yet</p>
                    ) : (
                        <div className="space-y-3">
                            {testResults.map((result, index) => (
                                <div
                                    key={index}
                                    className={`p-4 rounded-lg ${styles.testResultCard} ${
                                        result.status === "success"
                                            ? styles.testResultSuccess
                                            : result.status === "error"
                                            ? styles.testResultError
                                            : styles.testResultPending
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <span className={`font-mono text-sm ${styles.brandPrimaryText}`}>
                                            {result.functionName}
                                        </span>
                                        <span
                                            className={`text-xs font-bold ${
                                                result.status === "success" ? "text-green-400" : result.status === "error" ? "text-red-400" : "text-yellow-400"
                                            }`}
                                        >
                                            {result.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="text-gray-300 text-sm mb-2">{result.message}</p>
                                    {result.txHash && <p className="text-xs font-mono text-gray-400">Tx: {result.txHash}</p>}
                                    {result.data && <pre className="text-xs text-gray-400 mt-2 overflow-auto">{JSON.stringify(result.data, null, 2)}</pre>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Success Modal */}
                {showSuccessModal && successTxHash && (
                    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
                        <div className="bg-gray-800 border border-green-500 rounded-xl p-8 max-w-lg w-full mx-4 shadow-2xl">
                            <div className="flex items-center justify-center mb-6">
                                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            </div>

                            <h2 className="text-2xl font-bold text-white text-center mb-4">Transaction Successful!</h2>

                            <p className="text-gray-300 text-center mb-6">{successMessage}</p>

                            <div className="bg-gray-900 rounded-lg p-4 mb-6">
                                <p className="text-gray-400 text-sm mb-2">Transaction Hash:</p>
                                <div className="flex items-center justify-between gap-2">
                                    <code className="text-green-400 text-xs font-mono break-all">{successTxHash}</code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(successTxHash);
                                            alert("Transaction hash copied!");
                                        }}
                                        className="p-2 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                                        title="Copy transaction hash"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                <Link
                                    to={`/explorer/tx/${successTxHash}`}
                                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-center"
                                >
                                    View on Explorer
                                </Link>
                                <button
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        setSuccessTxHash(null);
                                    }}
                                    className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Powered by Block52 */}
            <div className="fixed bottom-4 left-4 flex items-center z-10 opacity-30">
                <div className="flex flex-col items-start bg-transparent px-3 py-2 rounded-lg backdrop-blur-sm border-0">
                    <div className="text-left mb-1">
                        <span className="text-xs text-white font-medium tracking-wide  ">POWERED BY</span>
                    </div>
                    <img src="/block52.png" alt="Block52 Logo" className="h-6 w-auto object-contain interaction-none" />
                </div>
            </div>
        </div>
    );
}
