"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
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
  currentUserRole,
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
  onSelectFriend,
  onRemoveFriend,
  onEditProfile,
  onLogout,
}: SidebarProps) {
  const t = useTranslations("sidebar");
  const th = useTranslations("header");

  const [openServerMenuId, setOpenServerMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [hoveredServerId, setHoveredServerId] = useState<string | null>(null);
  const [dotsPos, setDotsPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [copiedServerId, setCopiedServerId] = useState<string | null>(null);
  const serverMenuRef = useRef<HTMLDivElement | null>(null);
  const dotsButtonRef = useRef<HTMLButtonElement | null>(null);
  const hideDotsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (serverMenuRef.current && !serverMenuRef.current.contains(e.target as Node)) {
        setOpenServerMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogoMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, serverId: string) => {
    if (hideDotsTimer.current) clearTimeout(hideDotsTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setDotsPos({ top: rect.top + rect.height / 2 - 14, left: rect.right + 2 });
    setHoveredServerId(serverId);
  };

  const handleLogoMouseLeave = () => {
    hideDotsTimer.current = setTimeout(() => setHoveredServerId(null), 150);
  };

  const handleDotsMouseEnter = () => {
    if (hideDotsTimer.current) clearTimeout(hideDotsTimer.current);
  };

  const handleDotsMouseLeave = () => {
    if (!openServerMenuId) {
      hideDotsTimer.current = setTimeout(() => setHoveredServerId(null), 150);
    }
  };

  const handleOpenMenu = (e: React.MouseEvent<HTMLButtonElement>, serverId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.top, left: rect.right + 8 });
    setOpenServerMenuId((prev) => (prev === serverId ? null : serverId));
  };

  const handleCopyInvite = (e: React.MouseEvent, server: Server) => {
    e.stopPropagation();
    navigator.clipboard.writeText(server.invite_code);
    setCopiedServerId(server.id);
    setOpenServerMenuId(null);
    setTimeout(() => setCopiedServerId(null), 2000);
  };

  const handleLeave = (e: React.MouseEvent, serverId: string) => {
    e.stopPropagation();
    setOpenServerMenuId(null);
    onLeaveServer(serverId);
  };

  const handleRename = (e: React.MouseEvent, server: Server) => {
    e.stopPropagation();
    setOpenServerMenuId(null);
    const newName = prompt("Nouveau nom du serveur :", server.name);
    if (newName && newName.trim() && newName.trim() !== server.name) {
      onUpdateServer(server.id, newName.trim().slice(0, 20));
    }
  };

  const handleDelete = (e: React.MouseEvent, serverId: string) => {
    e.stopPropagation();
    setOpenServerMenuId(null);
    onDeleteServer(serverId);
  };
  
  const currentAccount = authService.getCurrentUser() as { username?: string; first_name?: string; last_name?: string; email?: string; avatar_url?: string } | null;
  const accountName =
    currentAccount?.username ||
    [currentAccount?.first_name, currentAccount?.last_name].filter(Boolean).join(" ").trim() ||
    currentAccount?.email ||
    "Nexus";
  const avatarUrl = currentAccount?.avatar_url;
  const initial = accountName.charAt(0).toUpperCase();

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
            const isOwner = isSelected && currentUserRole === "owner";
            const isMenuOpen = openServerMenuId === server.id;
            const isCopied = copiedServerId === server.id;

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
                  onMouseEnter={(e) => handleLogoMouseEnter(e, server.id)}
                  onMouseLeave={handleLogoMouseLeave}
                  title={server.name}
                  type="button"
                >
                  {isCopied ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    server.name.charAt(0).toUpperCase()
                  )}
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
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={accountName} width={32} height={32} unoptimized className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,_var(--brand-2),_var(--brand-1))] text-sm font-bold text-white">
                    {initial}
                  </div>
                )}
                
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

      {/* Bouton "..." fixed — apparaît à droite du logo au hover, hors du rail overflow */}
      {(hoveredServerId || openServerMenuId) && (() => {
        const visibleId = openServerMenuId ?? hoveredServerId;
        const server = serverList.find((s) => s.id === visibleId);
        if (!server) return null;
        const isOwner = visibleId === selectedServer && currentUserRole === "owner";
        return (
          <button
            ref={dotsButtonRef}
            type="button"
            className="fixed z-[9998] flex h-7 w-7 items-center justify-center rounded-[10px] bg-[rgba(20,30,45,0.97)] border border-[var(--stroke)] text-slate-300 transition hover:border-[rgba(21,209,255,0.4)] hover:text-white"
            style={{ top: dotsPos.top, left: dotsPos.left }}
            onMouseEnter={handleDotsMouseEnter}
            onMouseLeave={handleDotsMouseLeave}
            onClick={(e) => {
              handleOpenMenu(e, visibleId!);
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPos({ top: rect.top, left: rect.right + 8 });
            }}
            title="Options"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2.2" />
              <circle cx="12" cy="12" r="2.2" />
              <circle cx="12" cy="19" r="2.2" />
            </svg>
          </button>
        );
      })()}

      {/* Dropdown menu des serveurs — fixed pour échapper au overflow du rail */}
      {openServerMenuId && (() => {
        const server = serverList.find((s) => s.id === openServerMenuId);
        const isOwner = openServerMenuId === selectedServer && currentUserRole === "owner";
        if (!server) return null;
        return (
          <div
            ref={serverMenuRef}
            className="fixed z-[9999] min-w-[168px] rounded-[16px] border border-[var(--stroke)] bg-[rgba(12,19,29,0.98)] p-1.5 shadow-[0_20px_40px_rgba(2,8,18,0.42)]"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-[rgba(21,209,255,0.1)] hover:text-white"
              onClick={(e) => handleCopyInvite(e, server)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Code d&apos;invitation
            </button>
            {isOwner && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-[rgba(21,209,255,0.1)] hover:text-white"
                onClick={(e) => handleRename(e, server)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Renommer
              </button>
            )}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-sm text-rose-300 transition hover:bg-[rgba(255,84,109,0.12)] hover:text-rose-200"
              onClick={(e) => isOwner ? handleDelete(e, server.id) : handleLeave(e, server.id)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isOwner ? (
                  <>
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" /><path d="M14 11v6" />
                  </>
                ) : (
                  <>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </>
                )}
              </svg>
              {isOwner ? "Supprimer" : "Quitter"}
            </button>
          </div>
        );
      })()}
    </aside>
  );
}