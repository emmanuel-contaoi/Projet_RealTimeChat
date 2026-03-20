"use client";

import { useTranslations } from "next-intl";
import { authService } from "@/services/api";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { RefObject } from "react";
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
  isMenuOpen: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  unreadChannels: Set<string>;
  onToggleMenu: () => void;
  onTabChange: (tab: "servers" | "friends") => void;
  onSelectServer: (serverId: string) => void;
  onCreateServer: () => void;
  onJoinServer: () => void;
  onLeaveServer: (serverId: string) => void;
  onDeleteServer: (serverId: string) => void;
  onUpdateServer: (serverId: string, newName: string) => void;
  onEditProfile: () => void;
  onSwitchAccount: () => void;
  onLogout: () => void;
  onSelectFriend: (friend: Friend) => void;
  onRemoveFriend: (friendId: string) => void;
};

export default function Sidebar({
  activeTab,
  serverList,
  friendList,
  selectedServer,
  selectedFriend,
  isMenuOpen,
  menuRef,
  unreadChannels,
  onToggleMenu,
  onTabChange,
  onSelectServer,
  onCreateServer,
  onJoinServer,
  onLeaveServer,
  onDeleteServer,
  onUpdateServer,
  onEditProfile,
  onSwitchAccount,
  onLogout,
  currentUserRole,
  onSelectFriend,
  onRemoveFriend,
}: SidebarProps) {
  const t = useTranslations("sidebar");
  const th = useTranslations("header");
  const currentAccount = authService.getCurrentUser();
  const accountName =
    currentAccount?.username ||
    [currentAccount?.first_name, currentAccount?.last_name].filter(Boolean).join(" ").trim() ||
    currentAccount?.email ||
    "Nexus";
  return (
    <aside className="flex h-full min-h-0 flex-col border-b border-[var(--stroke)] bg-[var(--sidebar)] p-3 lg:border-b-0 lg:border-r">
      <div className="mb-3 flex items-center justify-start gap-2">
        <div className="relative z-20" ref={menuRef}>
          <button
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-[14px] border border-[var(--stroke)] bg-[rgba(22,31,45,0.92)] px-3 text-[13px] font-semibold whitespace-nowrap text-white transition hover:border-[var(--stroke-strong)] hover:bg-[rgba(27,40,58,0.96)]"
            onClick={onToggleMenu}
            type="button"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,_var(--brand-2),_var(--brand-1))] text-[13px] font-bold text-white">
              N
            </span>
            <span className="leading-none">{th("profile")}</span>
          </button>

          {isMenuOpen ? (
            <div className="absolute left-0 z-50 mt-3 w-56 max-w-[calc(100vw-2rem)] rounded-[22px] border border-[var(--stroke)] bg-[rgba(12,19,29,0.98)] p-2 text-sm shadow-[0_24px_48px_rgba(2,8,18,0.52)]">
              <button
                className="w-full rounded-2xl px-3 py-2.5 text-left text-slate-200 transition hover:bg-[var(--surface-strong)]"
                onClick={onEditProfile}
                type="button"
              >
                {th("edit_account")}
              </button>
              <button
                className="w-full rounded-2xl px-3 py-2.5 text-left text-slate-200 transition hover:bg-[var(--surface-strong)]"
                onClick={onSwitchAccount}
                type="button"
              >
                {th("switch_account")}
              </button>
              <button
                className="w-full rounded-2xl px-3 py-2.5 text-left text-rose-200 transition hover:bg-[rgba(255,84,109,0.12)]"
                onClick={onLogout}
                type="button"
              >
                {th("logout")}
              </button>
            </div>
          ) : null}
        </div>
        <LanguageSwitcher compact />
      </div>

      <div className="mt-1 rounded-[17px] bg-[rgba(17,25,37,0.92)] p-1.25">
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`relative rounded-[13px] px-2.5 py-2 text-[13px] font-semibold transition ${
              activeTab === "servers"
                ? "bg-[rgba(38,94,171,0.6)] text-[var(--brand-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                : "text-slate-400 hover:bg-[rgba(255,255,255,0.03)] hover:text-white"
            }`}
            onClick={() => onTabChange("servers")}
            type="button"
          >
            {t("servers")}
            {activeTab !== "servers" && unreadChannels.size > 0 && (
              <span className="absolute -top-1 -right-3 h-2 w-2 animate-pulse rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            )}
          </button>
          <button
            className={`relative rounded-[13px] px-2.5 py-2 text-[13px] font-semibold transition ${
              activeTab === "friends"
                ? "bg-[rgba(38,94,171,0.6)] text-[var(--brand-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                : "text-slate-400 hover:bg-[rgba(255,255,255,0.03)] hover:text-white"
            }`}
            onClick={() => onTabChange("friends")}
            type="button"
          >
            {t("friends")}
            {activeTab !== "friends" && unreadChannels.size > 0 && (
              <span className="absolute -top-1 -right-3 h-2 w-2 animate-pulse rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span>{activeTab === "servers" ? "Vue principale" : "Amis actifs"}</span>
        <span>
          {activeTab === "servers"
            ? t("servers_count", { count: serverList.length })
            : t("friends_count", { count: friendList.length })}
        </span>
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
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
