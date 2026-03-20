"use client";

import { useTranslations } from "next-intl";
import type { Friend } from "../types";

type FriendListProps = {
  friendList: Friend[];
  selectedFriend: string;
  unreadChannels: Set<string>;
  onSelectFriend: (friend: Friend) => void;
  onRemoveFriend: (friendId: string) => void;
};

export default function FriendList({
  friendList,
  selectedFriend,
  unreadChannels,
  onSelectFriend,
  onRemoveFriend,
}: FriendListProps) {
  const t = useTranslations("friends");

  return (
    <div className="flex flex-col gap-2.5">
      {friendList.map((friend) => {
        // On vérifie si c'est l'ami actuellement sélectionné
        const isSelected = selectedFriend === friend.id;
        
        // On vérifie s'il y a un message non lu pour cet ami
        const isUnread = unreadChannels.has(friend.id) && !isSelected;
        const friendInitial = friend.name.charAt(0).toUpperCase();

        return (
          <div
            key={friend.id}
            className={`group relative flex cursor-pointer items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left transition ${
              isSelected
                ? "border-[rgba(21,209,255,0.5)] bg-[rgba(20,33,49,0.98)]"
                : isUnread
                ? "border-[rgba(255,255,255,0.2)] bg-[rgba(19,28,41,0.94)]"
                : "border-[var(--stroke)] bg-[rgba(19,28,41,0.92)] hover:border-[rgba(21,209,255,0.24)] hover:bg-[rgba(22,33,48,0.96)]"
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
            {isUnread && (
              <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" />
            )}

            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,_var(--brand-2),_var(--brand-1))] text-base font-semibold text-white">
                {friendInitial}
              </div>
              <span
                className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[var(--sidebar)] ${
                  friend.status === "En ligne" ? "bg-[var(--success)]" : "bg-slate-600"
                }`}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className={`truncate text-base font-semibold transition-colors ${isUnread ? "text-white" : isSelected ? "text-white" : "text-slate-200 group-hover:text-white"}`}>
                  {friend.name}
                </p>
                {isSelected ? (
                  <span className="rounded-full border border-[rgba(21,209,255,0.35)] bg-[rgba(21,209,255,0.08)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-1)]">
                    Chat
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {friend.status === "En ligne" ? t("online") : t("offline")}
              </p>
            </div>

            <button
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--stroke)] bg-[rgba(14,21,31,0.92)] text-slate-300 opacity-0 transition hover:border-[rgba(255,84,109,0.25)] hover:text-rose-400 group-hover:opacity-100 focus:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                onRemoveFriend(friend.id);
              }}
              type="button"
              aria-label={`${t("remove")} ${friend.name}`}
              title={t("remove")}
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 6V4h8v2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        );
      })}

      {!friendList.length ? (
        <p className="rounded-[20px] border border-[var(--stroke)] bg-[rgba(19,28,41,0.92)] px-4 py-4 text-sm text-slate-400">
          Aucun ami pour le moment.
        </p>
      ) : null}
    </div>
  );
}
