import type { Server } from "../types";

type ServerListProps = {
  serverList: Server[];
  selectedServer: string;
  onSelectServer: (serverName: string) => void;
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
            key={server.name}
            className={`flex cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-3 transition ${
              selectedServer === server.name
                ? "border-[var(--brand-1)] bg-[rgba(0,212,255,0.12)]"
                : "border-[var(--stroke)] bg-[var(--surface-strong)] hover:bg-[var(--surface)]"
            }`}
            onClick={() => onSelectServer(server.name)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                onSelectServer(server.name);
              }
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{server.name}</p>
              <span className="rounded-full bg-[rgba(0,212,255,0.2)] px-2 py-1 text-[10px] font-semibold text-[var(--brand-1)]">
                {server.status}
              </span>
            </div>
            <p className="text-xs text-slate-400">{server.members}</p>
          </div>
        ))}
      </div>
    </>
  );
}
