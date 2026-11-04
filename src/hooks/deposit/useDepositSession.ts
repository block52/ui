import { useState, useCallback, useEffect } from "react";
import { DEPOSIT_ADDRESS } from "../../config/constants";
import { usePaymentApi } from "../../context/PaymentApiContext";
import { DepositSession, TransactionStatus } from "../../types";
import { isRecord } from "../../utils/guards";

interface UseDepositSessionReturn {
    sessionId: string | null;
    currentSession: DepositSession | null;
    showQR: boolean;
    timeLeft: number;
    transactionStatus: TransactionStatus;
    progressPercentage: number;
    isDepositCompleted: boolean;
    error: string | null;
    createSession: (userAddress: string) => Promise<(() => void) | undefined>;
    resetSession: () => void;
}

/**
 * Hook for managing deposit session lifecycle
 */
export const useDepositSession = (): UseDepositSessionReturn => {
    const paymentApi = usePaymentApi();
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [currentSession, setCurrentSession] = useState<DepositSession | null>(null);
    const [showQR, setShowQR] = useState<boolean>(false);
    const [timeLeft, setTimeLeft] = useState<number>(300);
    const [transactionStatus, setTransactionStatus] = useState<TransactionStatus>(null);
    const [progressPercentage, setProgressPercentage] = useState<number>(0);
    const [completionCountdown, setCompletionCountdown] = useState<number>(0);
    const [isDepositCompleted, setIsDepositCompleted] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Get progress percentage based on transaction status
    const getProgressFromStatus = (status: TransactionStatus): number => {
        switch (status) {
            case "DETECTED":
                return 20;
            case "PROCESSING":
                return 40;
            case "CONFIRMING":
                return 60;
            case "CONFIRMED":
                return 80;
            case "COMPLETED":
                return 100;
            default:
                return 0;
        }
    };

    // Update progress based on transaction status
    useEffect(() => {
        if (transactionStatus) {
            setProgressPercentage(getProgressFromStatus(transactionStatus));
            if (transactionStatus === "CONFIRMED") {
                setCompletionCountdown(20);
            }
        }
    }, [transactionStatus]);

    // Handle completion countdown
    useEffect(() => {
        if (completionCountdown <= 0) {
            if (transactionStatus === "CONFIRMED") {
                setTransactionStatus("COMPLETED");
            }
            return;
        }

        const timer = setInterval(() => {
            setCompletionCountdown(prev => prev - 1);
            const newProgress = 80 + ((30 - completionCountdown) / 30) * 20;
            setProgressPercentage(Math.min(newProgress, 100));
        }, 1000);

        return () => clearInterval(timer);
    }, [completionCountdown, transactionStatus]);

    // Countdown timer for session expiry
    useEffect(() => {
        if (!showQR || !currentSession || currentSession.status !== "PENDING" || timeLeft <= 0) {
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prevTime => {
                const newTime = prevTime - 1;
                if (newTime <= 0) {
                    setShowQR(false);
                    setCurrentSession(prev => (prev ? { ...prev, status: "EXPIRED" } : null));
                    return 0;
                }
                return newTime;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [showQR, currentSession, timeLeft]);

    // Poll for session status
    const checkSessionStatus = useCallback(
        async (userAddress: string) => {
            if (!sessionId || !currentSession || isDepositCompleted) return;

            try {
                const session = await paymentApi.getDepositSession(userAddress) as DepositSession & { txStatus?: TransactionStatus };

                if (session) {
                    setCurrentSession(session);
                    if (session.txStatus && session.txStatus !== transactionStatus) {
                        setTransactionStatus(session.txStatus);
                        if (session.txStatus === "COMPLETED") {
                            setIsDepositCompleted(true);
                        }
                    }
                }
            } catch (err) {
                console.error("Error checking session status:", err);
            }
        },
        [sessionId, currentSession, isDepositCompleted, transactionStatus, paymentApi]
    );

    // Create a new deposit session
    const createSession = useCallback(
        async (userAddress: string) => {
            try {
                const session = await paymentApi.createDepositSession({
                    userAddress,
                    depositAddress: DEPOSIT_ADDRESS
                }) as DepositSession & { _id: string };

                setCurrentSession(session);
                setSessionId(session._id);
                setShowQR(true);
                setTimeLeft(300);
                setError(null);
                setTransactionStatus(null);
                setProgressPercentage(0);
                setIsDepositCompleted(false);

                // Start polling for session status
                const pollInterval = setInterval(() => {
                    checkSessionStatus(userAddress);
                }, 5000);

                // Store interval ID for cleanup
                return () => clearInterval(pollInterval);
            } catch (err: unknown) {
                console.error("Failed to create deposit session:", err);
                // HTTPClient throws the response body on error (see HTTPClient.onError)
                if (isRecord(err) && "error" in err) {
                    const body = err as { error?: string };
                    setError(body.error || "Failed to create deposit session");
                } else {
                    setError("Failed to create deposit session");
                }
            }
        },
        [checkSessionStatus, paymentApi]
    );

    // Reset session state
    const resetSession = useCallback(() => {
        setSessionId(null);
        setCurrentSession(null);
        setShowQR(false);
        setTimeLeft(300);
        setTransactionStatus(null);
        setProgressPercentage(0);
        setIsDepositCompleted(false);
        setError(null);
    }, []);

    return {
        sessionId,
        currentSession,
        showQR,
        timeLeft,
        transactionStatus,
        progressPercentage,
        isDepositCompleted,
        error,
        createSession,
        resetSession
    };
};

export default useDepositSession;
