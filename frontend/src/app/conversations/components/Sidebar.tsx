"use client";

import { useTranslations } from "next-intl";
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
  onTabChange: (tab: "servers" | "friends") => void;
  onSelectServer: (serverId: string) => void;
  onCreateServer: () => void;
  onJoinServer: () => void;
  onLeaveServer: (serverId: string) => void;
  onDeleteServer: (serverId: string) => void;
  onUpdateServer: (serverId: string, newName: string) => void;
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
  onJoinServer,
  onLeaveServer,
  onDeleteServer,
  onUpdateServer,
  currentUserRole,
  onSelectFriend,
  onRemoveFriend,
}: SidebarProps) {
  const t = useTranslations("sidebar");

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className={`text-sm font-semibold transition ${
              activeTab === "servers" ? "text-white" : "text-slate-400 hover:text-white"
            }`}
            onClick={() => onTabChange("servers")}
            type="button"
          >
            {t("servers")}
          </button>
          <button
            className={`text-sm font-semibold transition ${
              activeTab === "friends" ? "text-white" : "text-slate-400 hover:text-white"
            }`}
            onClick={() => onTabChange("friends")}
            type="button"
          >
            {t("friends")}
          </button>
        </div>
        <span className="text-xs text-slate-400">
          {activeTab === "servers"
            ? t("servers_count", { count: serverList.length })
            : t("friends_count", { count: friendList.length })}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "servers" ? (
          <ServerList
            serverList={serverList}
            selectedServer={selectedServer}
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
            onSelectFriend={onSelectFriend}
            onRemoveFriend={onRemoveFriend}
          />
        )}
      </div>
    </aside>
  );
}
