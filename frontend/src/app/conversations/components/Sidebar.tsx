"use client";

import { useTranslations } from "next-intl";
import { authService } from "@/services/api";
import type { RefObject } from "react";
import type { Friend, Server } from "../types";
import FriendList from "./FriendList";

type SidebarProps = {
  activeTab: "servers" | "friends";
  serverList: Server[];
  friendList: Friend[];
  incomingFriendRequestCount: number;
  unreadMessageCountByFriendId: Record<string, number>;
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
  onLogout: () => void;
  onSelectFriend: (friend: Friend) => void;
  onRemoveFriend: (friendId: string) => void;
};

export default function Sidebar({
  activeTab,
  serverList,
  friendList,
  incomingFriendRequestCount,
  unreadMessageCountByFriendId,
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
  onSelectFriend,
  onRemoveFriend,
  onEditProfile,
  onLogout,
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
    <aside className="flex h-full min-h-0 bg-transparent">
      
      {/* RAIL PRINCIPAL (80px) : TOUJOURS VISIBLE */}
      <div className="flex w-[80px] shrink-0 flex-col items-center overflow-y-auto border-r border-[rgba(255,255,255,0.05)] bg-[rgba(12,18,27,0.9)] py-4 no-scrollbar">
        
        {/* Bouton Accueil / Amis */}
        <div className="relative group mb-3">
          <button
            className={`relative flex h-12 w-12 items-center justify-center transition-all duration-300 ${
              activeTab === "friends"
                ? "rounded-[16px] bg-[var(--brand-1)] text-white"
                : "rounded-[24px] bg-[rgba(255,255,255,0.05)] text-slate-300 hover:rounded-[16px] hover:bg-[var(--brand-1)] hover:text-white"
            }`}
            onClick={() => onTabChange("friends")}
            title={t("friends")}
            type="button"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </button>
        </div>

        <div className="mb-3 h-px w-8 bg-[rgba(255,255,255,0.08)]" />

        {/* Liste des Serveurs */}
        <div className="flex flex-col gap-2 w-full items-center">
          {serverList.map((server) => {
            const isSelected = activeTab === "servers" && selectedServer === server.id;
            return (
              <div key={server.id} className="relative group w-full flex justify-center">
                <div className={`absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-md bg-white transition-all duration-300 ${isSelected ? "h-10" : "h-0 group-hover:h-5"}`} />

                <button
                  className={`relative flex h-12 w-12 items-center justify-center text-lg font-bold transition-all duration-300 ${
                    isSelected
                      ? "rounded-[16px] bg-[var(--brand-1)] text-white"
                      : "rounded-[24px] bg-[rgba(255,255,255,0.05)] text-slate-300 hover:rounded-[16px] hover:bg-[var(--brand-1)] hover:text-white"
                  }`}
                  onClick={() => {
                    onTabChange("servers");
                    onSelectServer(server.id);
                  }}
                  title={server.name}
                  type="button"
                >
                  {server.name.charAt(0).toUpperCase()}
                </button>
              </div>
            );
          })}

          <button
            className="mt-2 flex h-12 w-12 items-center justify-center rounded-[24px] bg-[rgba(0,212,255,0.1)] text-[var(--brand-1)] transition-all hover:rounded-[16px] hover:bg-[var(--brand-1)] hover:text-white"
            onClick={onCreateServer}
            title={t("servers")}
            type="button"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          
          <button
            className="flex h-12 w-12 items-center justify-center rounded-[24px] bg-[rgba(255,255,255,0.05)] text-emerald-400 transition-all hover:rounded-[16px] hover:bg-emerald-500 hover:text-white"
            onClick={onJoinServer}
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
          </button>
        </div>
      </div>

      {/* PANNEAU SECONDAIRE (Amis/DMs) : VISIBLE UNIQUEMENT SI ONGLER "AMIS" EST ACTIF */}
      {activeTab === "friends" && (
        <div className="flex w-[240px] shrink-0 flex-col border-r border-[rgba(255,255,255,0.05)] bg-[rgba(16,24,35,0.95)]">
          
          {/* Section Profil Utilisateur */}
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.05)] p-3">
            <div className="relative w-full z-20" ref={menuRef}>
              <button
                className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-[rgba(255,255,255,0.05)]"
                onClick={onToggleMenu}
                type="button"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,_var(--brand-2),_var(--brand-1))] text-sm font-bold text-white">
                  N
                </div>
                <div className="flex flex-col items-start overflow-hidden">
                  <span className="w-full truncate text-[13px] font-semibold text-white leading-tight">{accountName}</span>
                </div>
              </button>

              {isMenuOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 w-[200px] rounded-xl border border-[var(--stroke)] bg-[rgba(12,19,29,0.98)] p-1.5 text-sm shadow-[0_24px_48px_rgba(2,8,18,0.52)]">
                  <button className="w-full rounded-lg px-3 py-2 text-left text-slate-200 transition hover:bg-[var(--surface-strong)]" onClick={onEditProfile} type="button">
                    {th("edit_account")}
                  </button>
                  <button className="w-full rounded-lg px-3 py-2 text-left text-rose-200 transition hover:bg-[rgba(255,84,109,0.12)]" onClick={onLogout} type="button">
                    {th("logout")}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bouton pour aller sur le pannel des demandes d'amis */}
          <div className="px-3 pt-3">
            <button
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition ${
                !selectedFriend 
                  ? "bg-[rgba(255,255,255,0.1)] text-white" 
                  : "text-slate-400 hover:bg-[rgba(255,255,255,0.05)] hover:text-slate-200"
              }`}
              onClick={() => onSelectFriend({ id: "", username: "Amis" } as unknown as Friend)}
              type="button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span>{t("friends")}</span>
              {incomingFriendRequestCount > 0 ? (
                <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-[0_0_10px_rgba(244,63,94,0.45)]">
                  {incomingFriendRequestCount}
                </span>
              ) : null}
            </button>
          </div>

          <div className="mt-4 px-4 pb-2 flex justify-between items-center">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Messages Directs
            </h3>
          </div>

          {/* Liste des DMs */}
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <FriendList
              friendList={friendList}
              selectedFriend={selectedFriend}
              unreadChannels={unreadChannels}
              unreadMessageCountByFriendId={unreadMessageCountByFriendId}
              onSelectFriend={onSelectFriend}
              onRemoveFriend={onRemoveFriend}
            />
          </div>

        </div>
      )}
    </aside>
  );
}
