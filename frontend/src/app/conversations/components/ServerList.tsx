import type { Server } from "../types";

type ServerListProps = {
  serverList: Server[];
  selectedServer: string;
  onSelectServer: (serverId: string) => void;
  onCreateServer: () => void;
};

export default function ServerList({
  serverList,
  selectedServer,
  onSelectServer,
  onCreateServer,
}: ServerListProps) {
  return (
    <>
      <button
        className="mt-4 w-full rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-left text-sm font-semibold text-[var(--brand-1)] transition hover:-translate-y-0.5 hover:bg-[var(--surface)]"
        onClick={onCreateServer}
        type="button"
      >
        + Créer un serveur
      </button>
      <div className="mt-4 flex flex-col gap-3">
        {serverList.map((server) => (
          <div
            key={server.id}
            className={`flex cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-3 transition ${
              selectedServer === server.id
                ? "border-[var(--brand-1)] bg-[rgba(0,212,255,0.12)]"
                : "border-[var(--stroke)] bg-[var(--surface-strong)] hover:bg-[var(--surface)]"
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
              <p className="text-sm font-semibold text-white">{server.name}</p>
              <span className="rounded-full bg-[rgba(0,212,255,0.2)] px-2 py-1 text-[10px] font-semibold text-[var(--brand-1)]">
                Actif
              </span>
            </div>
            <p className="text-xs text-slate-400">{server.invite_code}</p>
          </div>
        ))}
      </div>
    </>
  );
}
