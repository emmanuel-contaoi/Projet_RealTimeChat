import { useState } from "react";
import type { Server } from "../types";

type ServerListProps = {
  serverList: Server[];
  selectedServer: string;
  currentUserRole: string;
  onSelectServer: (serverId: string) => void;
  onCreateServer: () => void;
  onJoinServer: () => void;
  onLeaveServer: (serverId: string) => void;
  onDeleteServer: (serverId: string) => void;
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

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`text-[11px] transition ${
                    copiedId === server.id
                      ? "text-[var(--brand-1)]"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                  onClick={(e) => handleCopyCode(e, server)}
                  title="Copier le code d'invitation"
                >
                  {copiedId === server.id ? "Code copie !" : server.invite_code.slice(0, 8)}
                </button>

                <span className="text-slate-700">|</span>

                <button
                  type="button"
                  className="text-[11px] text-slate-500 hover:text-red-400 transition"
                  onClick={(e) => handleLeave(e, server.id)}
                >
                  Quitter
                </button>

                {isOwner && (
                  <>
                    <span className="text-slate-700">|</span>
                    <button
                      type="button"
                      className="text-[11px] text-slate-500 hover:text-red-400 transition"
                      onClick={(e) => handleDelete(e, server.id)}
                    >
                      Supprimer
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
