"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Server } from "../types";

type ServerListProps = {
  serverList: Server[];
  selectedServer: string;
  currentUserRole: string;
  // CORRECTION : unreadChannels a été supprimé d'ici
  onSelectServer: (serverId: string) => void;
  onCreateServer: () => void;
  onJoinServer: () => void;
  onLeaveServer: (serverId: string) => void;
  onDeleteServer: (serverId: string) => void;
  onUpdateServer: (serverId: string, newName: string) => void;
};

export default function ServerList({
  serverList,
  selectedServer,
  currentUserRole,
  onSelectServer,
  onCreateServer,
  onJoinServer,
  onLeaveServer,
  onDeleteServer,
  onUpdateServer,
}: ServerListProps) {
  const t = useTranslations("server_list");

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);

  const handleCopyCode = (e: React.MouseEvent, server: Server) => {
    e.stopPropagation();
    navigator.clipboard.writeText(server.invite_code);
    setCopiedId(server.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLeave = (e: React.MouseEvent, serverId: string) => {
    e.stopPropagation();
    onLeaveServer(serverId);
  };

  const handleDelete = (e: React.MouseEvent, serverId: string) => {
    e.stopPropagation();
    onDeleteServer(serverId);
  };

  const handleRename = (e: React.MouseEvent, server: Server) => {
    e.stopPropagation();
    const newName = prompt(t("rename_prompt"), server.name);
    if (newName && newName.trim() && newName.trim() !== server.name) {
      onUpdateServer(server.id, newName.trim().slice(0, 20));
    }
  };

  const handleToggleDetails = (e: React.MouseEvent, serverId: string) => {
    e.stopPropagation();
    const shouldOpen = expandedServerId !== serverId;
    setExpandedServerId(shouldOpen ? serverId : null);
    if (shouldOpen) {
      onSelectServer(serverId);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          className="rounded-[13px] border border-[rgba(21,209,255,0.4)] bg-[rgba(21,209,255,0.08)] px-2.5 py-2 text-center text-[13px] font-medium text-[var(--brand-1)] transition hover:bg-[rgba(21,209,255,0.14)]"
          onClick={onCreateServer}
          type="button"
        >
          {t("create")}
        </button>
        <button
          className="rounded-[13px] border border-[rgba(47,123,255,0.5)] bg-[rgba(47,123,255,0.08)] px-2.5 py-2 text-center text-[13px] font-medium text-[#6bb8ff] transition hover:bg-[rgba(47,123,255,0.14)]"
          onClick={onJoinServer}
          type="button"
        >
          {t("join")}
        </button>
      </div>

      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span>Serveurs actifs</span>
        <span>{serverList.length}</span>
      </div>

      <div className="flex flex-col gap-2">
        {serverList.length ? serverList.map((server) => {
          const isSelected = selectedServer === server.id;
          const isOwner = isSelected && currentUserRole === "owner";
          const isExpanded = expandedServerId === server.id;
          const serverInitial = server.name.charAt(0).toUpperCase();

          return (
            <div
              key={server.id}
              className={`group relative flex min-h-[76px] w-full cursor-pointer flex-col gap-2 rounded-[16px] border px-2.5 py-2.5 transition ${
                isSelected
                  ? "border-[rgba(21,209,255,0.55)] bg-[rgba(19,28,41,0.92)]"
                  : "border-[var(--stroke)] bg-[rgba(19,28,41,0.92)] hover:border-[rgba(21,209,255,0.28)] hover:bg-[rgba(22,33,48,0.96)]"
              }`}
              onClick={() => onSelectServer(server.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelectServer(server.id);
              }}
            >
              {isSelected ? (
                <span className="absolute right-4 top-2.5 h-2 w-2 rounded-full bg-[var(--brand-1)] shadow-[0_0_8px_rgba(21,209,255,0.75)]" />
              ) : null}

              <div className="flex min-h-[56px] items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-[linear-gradient(135deg,_rgba(47,123,255,0.95),_rgba(21,209,255,0.92))] text-[13px] font-bold text-white">
                  {serverInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base font-semibold leading-none text-white">{server.name}</p>
                  </div>
                  <p className="mt-1 text-[10px] leading-none text-slate-400">{server.invite_code}</p>
                </div>
                <button
                  type="button"
                  className="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full border border-[var(--stroke)] text-slate-400 transition hover:border-[rgba(21,209,255,0.35)] hover:text-[var(--brand-1)]"
                  onClick={(e) => handleToggleDetails(e, server.id)}
                  title={isExpanded ? "Masquer les infos" : "Afficher les infos"}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition ${isExpanded ? "rotate-90" : ""}`}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              {isExpanded ? (
                <>
                  <div className="h-px bg-[rgba(90,122,161,0.22)]" />

                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      className={`rounded-full border border-[var(--stroke)] px-2.5 py-0.5 text-[10px] transition ${
                        copiedId === server.id
                          ? "border-[rgba(21,209,255,0.45)] text-[var(--brand-1)]"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                      onClick={(e) => handleCopyCode(e, server)}
                      title={t("copy_invite")}
                    >
                      {copiedId === server.id ? t("copied") : server.invite_code.slice(0, 8)}
                    </button>

                    <button
                      type="button"
                      className="shrink-0 rounded-full border border-[var(--stroke)] p-1.25 text-slate-500 transition hover:border-[rgba(255,84,109,0.28)] hover:text-red-400"
                      onClick={(e) => handleLeave(e, server.id)}
                      title={t("leave")}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    </button>

                    {isOwner && (
                      <>
                        <button
                          type="button"
                          className="shrink-0 rounded-full border border-[var(--stroke)] p-1.25 text-slate-500 transition hover:border-[rgba(21,209,255,0.28)] hover:text-[var(--brand-1)]"
                          onClick={(e) => handleRename(e, server)}
                          title={t("rename")}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="shrink-0 rounded-full border border-[var(--stroke)] p-1.25 text-slate-500 transition hover:border-[rgba(255,84,109,0.28)] hover:text-red-400"
                          onClick={(e) => handleDelete(e, server.id)}
                          title={t("delete")}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" /><path d="M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          );
        }) : (
          <p className="rounded-[20px] border border-[var(--stroke)] bg-[rgba(19,28,41,0.92)] px-4 py-4 text-sm text-slate-400">
            Aucun serveur disponible.
          </p>
        )}
      </div>
    </div>
  );
}
