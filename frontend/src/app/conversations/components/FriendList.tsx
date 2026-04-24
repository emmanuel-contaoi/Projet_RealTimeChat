"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import type { Friend } from "../types";

type FriendListProps = {
  friendList: Friend[];
  selectedFriend: string;
  unreadChannels: Set<string>;
  unreadMessageCountByFriendId: Record<string, number>;
  onSelectFriend: (friend: Friend) => void;
  onRemoveFriend: (friendId: string) => void;
};

const getColorFromName = (name: string) => {
  const colors = [
    "from-rose-500 to-fuchsia-500",
    "from-blue-500 to-cyan-400",
    "from-emerald-500 to-teal-400",
    "from-amber-500 to-orange-400",
    "from-violet-500 to-purple-500",
    "from-sky-500 to-blue-400",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function FriendList({
  friendList,
  selectedFriend,
  unreadChannels,
  unreadMessageCountByFriendId,
  onSelectFriend,
  onRemoveFriend,
}: FriendListProps) {
  const t = useTranslations("friends");

  return (
    <div className="flex flex-col gap-2.5">
      {friendList.map((friend) => {
        const isSelected = selectedFriend === friend.id;
        const isUnread = unreadChannels.has(friend.id) && !isSelected;
        const unreadCount = isSelected ? 0 : (unreadMessageCountByFriendId[friend.id] ?? 0);
        const friendInitial = friend.name.charAt(0).toUpperCase();

        return (
          <div
            key={friend.id}
            className={`group relative flex cursor-pointer items-center gap-3 rounded-[18px] border px-3.5 py-3 pr-14 text-left transition ${
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
            <div className="relative shrink-0">
              {friend.avatar_url ? (
                <Image 
                  src={friend.avatar_url} 
                  alt={friend.name} 
                  width={40}
                  height={40}
                  unoptimized
                  className="h-10 w-10 rounded-full object-cover shadow-[0_2px_8px_rgba(0,0,0,0.2)]" 
                />
              ) : (
                <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${getColorFromName(friend.name)} text-base font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]`}>
                  {friendInitial}
                </div>
              )}
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

            {unreadCount > 0 ? (
              <span
                className="absolute bottom-1 right-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-[rgba(19,28,41,0.98)] bg-rose-500 px-1.5 text-[11px] font-bold leading-none text-white shadow-[0_0_12px_rgba(244,63,94,0.72)]"
                aria-label={`${unreadCount} nouveaux messages`}
                title={`${unreadCount} nouveaux messages`}
              >
                {Math.min(unreadCount, 99)}
              </span>
            ) : null}

            <button
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--stroke)] bg-[rgba(14,21,31,0.92)] text-slate-300 opacity-0 transition hover:border-[rgba(255,84,109,0.25)] hover:text-rose-400 group-hover:opacity-100 focus:opacity-100"
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