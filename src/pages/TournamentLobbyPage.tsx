import { useCallback, useEffect, useState } from "react";
import { AnimatedBackground } from "../components/common/AnimatedBackground";
import { ExplorerEmpty, ExplorerError, ExplorerLoading, ExplorerPanel, ExplorerReloadButton } from "../components/explorer/ExplorerPanel";
import { TournamentCard } from "../components/tournament/TournamentCard";
import { TournamentRegisterModal } from "../components/tournament/TournamentRegisterModal";
import { CreateTournamentModal } from "../components/tournament/CreateTournamentModal";
import { useNow, useTournamentLobby } from "../hooks/tournament/useTournamentLobby";
import { useTournamentActions } from "../hooks/tournament/useTournamentActions";
import { isEmpty } from "../utils/guards";
import type { TournamentLobbyCard } from "../utils/tournamentLobby";

interface PendingAction {
    card: TournamentLobbyCard;
    mode: "register" | "unregister";
}

/** /tournaments: multi-table tournaments to register for, and the form to create one (ui#980). */
export default function TournamentLobbyPage() {
    const { cards, isLoading, error, failedCount, refresh } = useTournamentLobby();
    const actions = useTournamentActions(refresh);
    const now = useNow(1000);
    const [pending, setPending] = useState<PendingAction | null>(null);
    const [creating, setCreating] = useState(false);
    const [createdId, setCreatedId] = useState<string | null>(null);

    useEffect(() => {
        document.title = "Tournaments - Block52";
        return () => {
            document.title = "Block52 Chain";
        };
    }, []);

    const closeModals = useCallback(() => {
        setPending(null);
        setCreating(false);
        actions.clearError();
    }, [actions]);

    const confirm = async () => {
        if (!pending) return;
        const ok = pending.mode === "register" ? await actions.register(pending.card.tournamentId) : await actions.unregister(pending.card.tournamentId);
        if (ok) setPending(null);
    };

    return (
        <div className="min-h-screen p-4 sm:p-8 relative">
            <AnimatedBackground />
            <div className="max-w-5xl mx-auto relative z-10">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <h1 className="text-2xl font-bold text-white">Tournaments</h1>
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white"
                        data-testid="open-create-tournament"
                    >
                        Create tournament
                    </button>
                </div>

                {createdId && (
                    <p role="status" className="mb-3 text-sm text-green-400" data-testid="tournament-created-note">
                        Tournament created. Players can register now.
                    </p>
                )}

                <ExplorerPanel header="Multi-table tournaments" action={<ExplorerReloadButton onClick={refresh} busy={isLoading} />}>
                    {isLoading && isEmpty(cards) ? (
                        <ExplorerLoading label="Loading tournaments…" />
                    ) : error ? (
                        <ExplorerError>{error}</ExplorerError>
                    ) : isEmpty(cards) ? (
                        <ExplorerEmpty>No tournaments yet. Create the first one.</ExplorerEmpty>
                    ) : (
                        <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                            {cards.map(card => (
                                <TournamentCard
                                    key={card.tournamentId}
                                    card={card}
                                    nowMs={now}
                                    onRegister={c => setPending({ card: c, mode: "register" })}
                                    onUnregister={c => setPending({ card: c, mode: "unregister" })}
                                />
                            ))}
                        </div>
                    )}
                </ExplorerPanel>

                {failedCount > 0 && (
                    <p role="status" className="mt-3 text-sm text-yellow-400">
                        {failedCount} {failedCount === 1 ? "tournament" : "tournaments"} could not be read and {failedCount === 1 ? "is" : "are"} not shown.
                    </p>
                )}
                <p className="mt-4 text-xs text-gray-400">
                    The entry fee and the protocol fee come out of the buy-in when you register and are not refunded. Unregistering, or a tournament cancelled for too
                    few entrants, returns only the rest of the buy-in held in escrow.
                </p>
            </div>

            <TournamentRegisterModal
                card={pending?.card ?? null}
                mode={pending?.mode ?? "register"}
                busy={actions.busy}
                error={actions.error}
                onConfirm={confirm}
                onClose={closeModals}
            />
            <CreateTournamentModal
                isOpen={creating}
                busy={actions.busy}
                error={actions.error}
                onSubmit={async params => {
                    const id = await actions.create(params);
                    if (id) {
                        setCreatedId(id);
                        setCreating(false);
                    }
                }}
                onClose={closeModals}
            />
        </div>
    );
}
