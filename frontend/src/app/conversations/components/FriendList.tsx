import type { Friend } from "../types";

type FriendListProps = {
  friendList: Friend[];
  selectedFriend: string;
  // 🔴 NOUVEAU : On récupère la liste des salons non lus
  unreadChannels: Set<string>;
  onSelectFriend: (friend: Friend) => void;
  onRemoveFriend: (friendId: string) => void;
};

export default function FriendList({
  friendList,
  selectedFriend,
  unreadChannels, // <-- Récupéré ici
  onSelectFriend,
  onRemoveFriend,
}: FriendListProps) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      {friendList.map((friend) => {
        // On vérifie si c'est l'ami actuellement sélectionné (sur l'ID, c'est plus sûr !)
        const isSelected = selectedFriend === friend.id;
        
        // 🔴 NOUVEAU : On vérifie s'il y a un message non lu pour cet ami
        // (En général dans les DMs, l'ID du channel privé ou l'ID de l'ami se retrouvent ici)
        const isUnread = unreadChannels.has(friend.id) && !isSelected;

        return (
          <div
            key={friend.id}
            className={`group relative flex cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition ${
              isSelected
                ? "border-[var(--brand-1)] bg-[rgba(0,212,255,0.12)]"
                : isUnread
                ? "border-[rgba(255,255,255,0.2)] bg-[var(--surface-strong)]" // Plus visible si non lu
                : "border-[var(--stroke)] bg-[var(--surface-strong)] hover:bg-[var(--surface)]"
            }`}
            onClick={() => onSelectFriend(friend)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                onSelectFriend(friend);
              }
            }}
            role="button"
            tabIndex={0}
          >
            {/* 🔴 LA PASTILLE DE NOTIFICATION */}
            {isUnread && (
              <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" />
            )}

            <div className="flex items-center justify-between">
              <p className={`text-sm transition-colors ${isUnread ? "text-white font-bold" : isSelected ? "text-white font-semibold" : "text-slate-200 font-semibold group-hover:text-white"}`}>
                {friend.name}
              </p>
              
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                    friend.status === "En ligne"
                      ? "bg-[rgba(74,222,128,0.2)] text-green-400"
                      : "bg-[rgba(100,116,139,0.2)] text-slate-400"
                  }`}
                >
                  {friend.status}
                </span>
                
                <button
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--surface)] text-slate-300 transition hover:bg-[rgba(255,77,255,0.12)] hover:text-rose-400 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveFriend(friend.id);
                  }}
                  type="button"
                  aria-label={`Supprimer ${friend.name}`}
                  title="Supprimer l'ami"
                >
                  <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 6V4h8v2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}