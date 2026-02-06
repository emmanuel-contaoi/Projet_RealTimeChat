import type { Friend, Server } from "../types";
import FriendList from "./FriendList";
import ServerList from "./ServerList";

type SidebarProps = {
  activeTab: "servers" | "friends";
  serverList: Server[];
  friendList: Friend[];
  selectedServer: string;
  selectedFriend: string;
  onTabChange: (tab: "servers" | "friends") => void;
  onSelectServer: (serverId: string) => void;
  onCreateServer: () => void;
  onSelectFriend: (friendName: string) => void;
  onRemoveFriend: (friendId: string) => void;
};

export default function Sidebar({
  activeTab,
  serverList,
  friendList,
  selectedServer,
  selectedFriend,
  onTabChange,
  onSelectServer,
  onCreateServer,
  onSelectFriend,
  onRemoveFriend,
}: SidebarProps) {
  return (
    <aside className="h-full rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className={`text-sm font-semibold transition ${
              activeTab === "servers"
                ? "text-white"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => onTabChange("servers")}
            type="button"
          >
            Serveurs
          </button>
          <button
            className={`text-sm font-semibold transition ${
              activeTab === "friends"
                ? "text-white"
                : "text-slate-400 hover:text-white"
            }`}
            onClick={() => onTabChange("friends")}
            type="button"
          >
            Amis
          </button>
        </div>
        <span className="text-xs text-slate-400">
          {activeTab === "servers"
            ? `${serverList.length} actifs`
            : `${friendList.length} amis`}
        </span>
      </div>

      {activeTab === "servers" ? (
        <ServerList
          serverList={serverList}
          selectedServer={selectedServer}
          onSelectServer={onSelectServer}
          onCreateServer={onCreateServer}
        />
      ) : (
        <FriendList
          friendList={friendList}
          selectedFriend={selectedFriend}
          onSelectFriend={onSelectFriend}
          onRemoveFriend={onRemoveFriend}
        />
      )}
    </aside>
  );
}
