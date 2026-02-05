import type { UserSearchResult } from "../types";
import { formatUserLabel } from "../utils";

type FriendsPanelProps = {
  friendSearch: string;
  onFriendSearchChange: (value: string) => void;
  friendSearchError: string;
  friendSearchLoading: boolean;
  friendResults: UserSearchResult[];
  allUsersLoading: boolean;
  allUsers: UserSearchResult[];
  onAddFriend: (user: UserSearchResult) => void;
};

export default function FriendsPanel({
  friendSearch,
  onFriendSearchChange,
  friendSearchError,
  friendSearchLoading,
  friendResults,
  allUsersLoading,
  allUsers,
  onAddFriend,
}: FriendsPanelProps) {
  const trimmedSearch = friendSearch.trim();

  const renderUserList = (users: UserSearchResult[]) => (
    <div className="flex max-h-[55vh] flex-col gap-2 overflow-auto pr-1">
      {users.map((user) => {
        const label = formatUserLabel(user);
        return (
          <div
            key={user.id}
            className="flex items-center justify-between rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-white">{label}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
            <button
              className="rounded-full bg-[var(--brand-1)] px-4 py-2 text-xs font-semibold text-slate-900"
              onClick={() => onAddFriend(user)}
              type="button"
            >
              +
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <section className="flex h-full flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">
            Trouver des utilisateurs
          </p>
          <p className="text-xs text-slate-400">
            Recherche et ajoute de nouveaux amis
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <label className="grid gap-2 text-sm text-slate-200">
          Rechercher
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
              <p className="text-xs text-slate-400">
                Chargement des utilisateurs...
              </p>
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
