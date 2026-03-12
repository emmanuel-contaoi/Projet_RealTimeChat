import type { Friend, FriendRequest, UserSearchResult } from "../types";
import { formatUserLabel } from "../utils";

type FriendsPanelProps = {
  friendSearch: string;
  onFriendSearchChange: (value: string) => void;
  friendSearchError: string;
  friendSearchLoading: boolean;
  friendResults: UserSearchResult[];
  allUsersLoading: boolean;
  allUsers: UserSearchResult[];
  friendList: Friend[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  onSendFriendRequest: (user: UserSearchResult) => void;
  onAcceptRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  onCancelRequest: (requestId: string) => void;
};

export default function FriendsPanel({
  friendSearch,
  onFriendSearchChange,
  friendSearchError,
  friendSearchLoading,
  friendResults,
  allUsersLoading,
  allUsers,
  friendList,
  incomingRequests,
  outgoingRequests,
  onSendFriendRequest,
  onAcceptRequest,
  onRejectRequest,
  onCancelRequest,
}: FriendsPanelProps) {
  const trimmedSearch = friendSearch.trim();
  const friendIds = new Set(friendList.map((friend) => friend.id));
  const incomingByUserId = new Map(incomingRequests.map((request) => [request.user.id, request]));
  const outgoingByUserId = new Map(outgoingRequests.map((request) => [request.user.id, request]));

  const renderUserList = (users: UserSearchResult[]) => (
    <div className="flex max-h-[45vh] flex-col gap-2 overflow-auto pr-1">
      {users.map((user) => {
        const label = formatUserLabel(user);
        const incoming = incomingByUserId.get(user.id);
        const outgoing = outgoingByUserId.get(user.id);
        const isFriend = friendIds.has(user.id);

        return (
          <div
            key={user.id}
            className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>

            {isFriend ? (
              <span className="rounded-full border border-[var(--stroke)] px-3 py-1 text-[11px] text-slate-300">
                Ami
              </span>
            ) : incoming ? (
              <div className="flex items-center gap-1">
                <button
                  className="rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-semibold text-slate-900"
                  onClick={() => onAcceptRequest(incoming.id)}
                  type="button"
                >
                  Accepter
                </button>
                <button
                  className="rounded-full border border-[var(--stroke)] px-3 py-1.5 text-[11px] text-slate-200"
                  onClick={() => onRejectRequest(incoming.id)}
                  type="button"
                >
                  Refuser
                </button>
              </div>
            ) : outgoing ? (
              <button
                className="rounded-full border border-[var(--stroke)] px-3 py-1.5 text-[11px] text-slate-200"
                onClick={() => onCancelRequest(outgoing.id)}
                type="button"
              >
                En attente
              </button>
            ) : (
              <button
                className="rounded-full bg-[var(--brand-1)] px-4 py-2 text-xs font-semibold text-slate-900"
                onClick={() => onSendFriendRequest(user)}
                type="button"
              >
                Ajouter
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <section className="flex h-full flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Demandes d&apos;amis</p>
          <p className="text-xs text-slate-400">Envoie, accepte ou refuse des demandes</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
            Demandes recues
          </p>
          {incomingRequests.length ? (
            <div className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
              {incomingRequests.map((request) => {
                const label = formatUserLabel(request.user);
                return (
                  <div key={request.id} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-white">{label}</p>
                      <p className="text-[11px] text-slate-400">{request.user.email}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="rounded-full bg-emerald-400 px-3 py-1.5 text-[11px] font-semibold text-slate-900"
                        onClick={() => onAcceptRequest(request.id)}
                        type="button"
                      >
                        Accepter
                      </button>
                      <button
                        className="rounded-full border border-[var(--stroke)] px-3 py-1.5 text-[11px] text-slate-200"
                        onClick={() => onRejectRequest(request.id)}
                        type="button"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Aucune demande recue.</p>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
            Demandes envoyees
          </p>
          {outgoingRequests.length ? (
            <div className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
              {outgoingRequests.map((request) => {
                const label = formatUserLabel(request.user);
                return (
                  <div key={request.id} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-white">{label}</p>
                      <p className="text-[11px] text-slate-400">{request.user.email}</p>
                    </div>
                    <button
                      className="rounded-full border border-[var(--stroke)] px-3 py-1.5 text-[11px] text-slate-200"
                      onClick={() => onCancelRequest(request.id)}
                      type="button"
                    >
                      Annuler
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Aucune demande envoyee.</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <label className="grid gap-2 text-sm text-slate-200">
          Rechercher des utilisateurs
          <input
            className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
            value={friendSearch}
            onChange={(event) => onFriendSearchChange(event.target.value)}
            placeholder="Pseudo, email, prenom..."
          />
        </label>

        {friendSearchError ? (
          <p className="text-xs text-rose-200">{friendSearchError}</p>
        ) : null}

        {friendSearchLoading ? (
          <p className="text-xs text-slate-400">Recherche en cours...</p>
        ) : null}

        {trimmedSearch && !friendSearchLoading ? (
          friendResults.length ? (
            renderUserList(friendResults)
          ) : (
            <p className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
              Aucun utilisateur trouve.
            </p>
          )
        ) : (
          <div className="flex flex-col gap-2">
            {allUsersLoading ? (
              <p className="text-xs text-slate-400">Chargement des utilisateurs...</p>
            ) : allUsers.length ? (
              renderUserList(allUsers)
            ) : (
              <p className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
                Aucun utilisateur disponible.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
