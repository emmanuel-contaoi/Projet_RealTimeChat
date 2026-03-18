import type { Friend, Server } from "../types";
import FriendList from "./FriendList";
import ServerList from "./ServerList";

type SidebarProps = {
  activeTab: "servers" | "friends";
  serverList: Server[];
  friendList: Friend[];
  selectedServer: string;
  selectedFriend: string;
  currentUserRole: string;
  unreadChannels: Set<string>;
  onTabChange: (tab: "servers" | "friends") => void;
  onSelectServer: (serverId: string) => void;
  onCreateServer: () => void;
  onJoinServer: () => void;
  onLeaveServer: (serverId: string) => void;
  onDeleteServer: (serverId: string) => void;
  onUpdateServer: (serverId: string, newName: string) => void;
  onSelectFriend: (friend: Friend) => void;
  onRemoveFriend: (friendId: string) => void;
};

export default function Sidebar({
  activeTab,
  serverList,
  friendList,
  selectedServer,
  selectedFriend,
  unreadChannels,
  onTabChange,
  onSelectServer,
  onCreateServer,
  onJoinServer,
  onLeaveServer,
  onDeleteServer,
  onUpdateServer,
  currentUserRole,
  onSelectFriend,
  onRemoveFriend,
}: SidebarProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            className={`relative text-sm font-semibold transition ${
              activeTab === "servers"
                ? "text-white"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => onTabChange("servers")}
            type="button"
          >
            Serveurs
            {activeTab !== "servers" && unreadChannels.size > 0 && (
              <span className="absolute -top-1 -right-3 h-2 w-2 animate-pulse rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            )}
          </button>
          <button
            className={`relative text-sm font-semibold transition ${
              activeTab === "friends"
                ? "text-white"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => onTabChange("friends")}
            type="button"
          >
            Amis
            {activeTab !== "friends" && unreadChannels.size > 0 && (
              <span className="absolute -top-1 -right-3 h-2 w-2 animate-pulse rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            )}
          </button>
        </div>
        <span className="text-xs text-slate-400">
          {activeTab === "servers"
            ? `${serverList.length} actifs`
            : `${friendList.length} amis`}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto mt-4">
        {activeTab === "servers" ? (
          <ServerList
            serverList={serverList}
            selectedServer={selectedServer}
            unreadChannels={unreadChannels}
            onSelectServer={onSelectServer}
            currentUserRole={currentUserRole}
            onCreateServer={onCreateServer}
            onJoinServer={onJoinServer}
            onLeaveServer={onLeaveServer}
            onDeleteServer={onDeleteServer}
            onUpdateServer={onUpdateServer}
          />
        ) : (
          <FriendList
            friendList={friendList}
            selectedFriend={selectedFriend}
            unreadChannels={unreadChannels}
            onSelectFriend={onSelectFriend}
            onRemoveFriend={onRemoveFriend}
          />
        )}
      </div>
    </aside>
  );
}