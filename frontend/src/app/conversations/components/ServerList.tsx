import { useState } from "react";
import type { Server } from "../types";

type ServerListProps = {
  serverList: Server[];
  selectedServer: string;
  currentUserRole: string;
  unreadChannels: Set<string>;
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
  unreadChannels,
  onSelectServer,
  onCreateServer,
  onJoinServer,
  onLeaveServer,
  onDeleteServer,
  onUpdateServer,
}: ServerListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    const newName = prompt("Nouveau nom du serveur (20 caracteres max) :", server.name);
    if (newName && newName.trim() && newName.trim() !== server.name) {
      onUpdateServer(server.id, newName.trim().slice(0, 20));
    }
  };

  return (
    <>
      <div className="mt-4 flex gap-2">
        <button
          className="flex-1 rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-center text-sm font-semibold text-[var(--brand-1)] transition hover:-translate-y-0.5 hover:bg-[var(--surface)]"
          onClick={onCreateServer}
          type="button"
        >
          + Creer
        </button>
        <button
          className="flex-1 rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-center text-sm font-semibold text-[var(--brand-1)] transition hover:-translate-y-0.5 hover:bg-[var(--surface)]"
          onClick={onJoinServer}
          type="button"
        >
          Rejoindre
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {serverList.map((server) => {
          const isSelected = selectedServer === server.id;
          const isOwner = isSelected && currentUserRole === "owner";

          return (
            <div
              key={server.id}
              className={`group flex cursor-pointer flex-col gap-1.5 rounded-2xl border px-4 py-3 transition ${
                isSelected
                  ? "border-[var(--brand-1)] bg-[rgba(0,212,255,0.10)]"
                  : "border-[var(--stroke)] bg-[var(--surface-strong)] hover:border-[rgba(0,212,255,0.3)] hover:bg-[var(--surface)]"
              }`}
              onClick={() => onSelectServer(server.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  onSelectServer(server.id);
                }
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white truncate">{server.name}</p>
                {isSelected && (
                  <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand-1)]" />
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className={`shrink-0 text-[11px] transition ${
                    copiedId === server.id
                      ? "text-[var(--brand-1)]"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                  onClick={(e) => handleCopyCode(e, server)}
                  title="Copier le code d'invitation"
                >
                  {copiedId === server.id ? "Copie !" : server.invite_code.slice(0, 8)}
                </button>

                <button
                  type="button"
                  className="shrink-0 rounded-full p-1 text-slate-600 transition hover:text-red-400"
                  onClick={(e) => handleLeave(e, server.id)}
                  title="Quitter le serveur"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>

                {isOwner && (
                  <>
                    <button
                      type="button"
                      className="shrink-0 rounded-full p-1 text-slate-600 transition hover:text-[var(--brand-1)]"
                      onClick={(e) => handleRename(e, server)}
                      title="Renommer le serveur"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="shrink-0 rounded-full p-1 text-slate-600 transition hover:text-red-400"
                      onClick={(e) => handleDelete(e, server.id)}
                      title="Supprimer le serveur"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}