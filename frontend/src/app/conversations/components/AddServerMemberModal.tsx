import type { Friend } from "../types";

type AddServerMemberModalProps = {
  isOpen: boolean;
  serverName: string;
  friends: Friend[];
  members: string[];
  onClose: () => void;
  onAddMember: (friendId: string) => void;
};

export default function AddServerMemberModal({
  isOpen,
  serverName,
  friends,
  members,
  onClose,
  onAddMember,
}: AddServerMemberModalProps) {
  if (!isOpen) return null;

  const hasServer = Boolean(serverName);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-[rgba(5,12,25,0.8)] backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[0_20px_40px_rgba(6,10,20,0.6)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Serveur
            </p>
            <h3 className="font-display text-xl text-white">
              Ajouter un ami
            </h3>
            {hasServer ? (
              <p className="mt-1 text-xs text-slate-400">{serverName}</p>
            ) : null}
          </div>
          <button
            className="rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-1 text-xs text-slate-200 transition hover:bg-[var(--surface)]"
            onClick={onClose}
            type="button"
          >
            Fermer
          </button>
        </div>

        {!hasServer ? (
          <p className="mt-5 rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
            Aucun serveur sélectionné.
          </p>
        ) : (
          <div className="mt-5 flex max-h-[55vh] flex-col gap-3 overflow-auto pr-1">
            {friends.length ? (
              friends.map((friend) => {
                const isAdded = members.includes(friend.id);
                return (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {friend.name}
                      </p>
                      <p className="text-xs text-slate-400">{friend.status}</p>
                    </div>
                    <button
                      className="rounded-full bg-[var(--brand-1)] px-4 py-2 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => onAddMember(friend.id)}
                      type="button"
                      disabled={isAdded}
                    >
                      {isAdded ? "Ajouté" : "Ajouter"}
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
                Aucun ami disponible.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
