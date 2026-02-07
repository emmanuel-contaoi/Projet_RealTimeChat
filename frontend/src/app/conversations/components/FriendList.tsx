import type { Friend } from "../types";

type FriendListProps = {
  friendList: Friend[];
  selectedFriend: string;
  onSelectFriend: (friendName: string) => void;
  onRemoveFriend: (friendId: string) => void;
};

export default function FriendList({
  friendList,
  selectedFriend,
  onSelectFriend,
  onRemoveFriend,
}: FriendListProps) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      {friendList.map((friend) => (
        <div
          key={friend.id}
          className={`flex cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition ${
            selectedFriend === friend.name
              ? "border-[var(--brand-1)] bg-[rgba(0,212,255,0.12)]"
              : "border-[var(--stroke)] bg-[var(--surface-strong)] hover:bg-[var(--surface)]"
          }`}
          onClick={() => onSelectFriend(friend.name)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              onSelectFriend(friend.name);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">{friend.name}</p>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                friend.status === "En ligne"
                  ? "bg-[rgba(74,222,128,0.2)] text-green-400"
                  : "bg-[rgba(100,116,139,0.2)] text-slate-400"
              }`}>
                {friend.status}
              </span>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--surface)] text-slate-300 transition hover:bg-[rgba(255,77,255,0.12)]"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemoveFriend(friend.id);
                }}
                type="button"
                aria-label={`Supprimer ${friend.name}`}
                title="Supprimer"
              >
                <svg
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 6h18" strokeLinecap="round" strokeLinejoin="round" />
                  <path
                    d="M8 6V4h8v2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6 6l1 14h10l1-14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
