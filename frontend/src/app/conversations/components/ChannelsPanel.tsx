import type { Channel } from "../types";

type ChannelsPanelProps = {
  channels: Channel[];
  selectedChannel: string;
  onSelectChannel: (channelId: string) => void;
  onAddMember?: () => void;
};

export default function ChannelsPanel({
  channels,
  selectedChannel,
  onSelectChannel,
  onAddMember,
}: ChannelsPanelProps) {
  return (
    <section className="h-full rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Channels</p>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] text-[var(--brand-1)] transition hover:-translate-y-0.5 hover:bg-[var(--surface)]"
          onClick={onAddMember}
          type="button"
          aria-label="Ajouter un ami au serveur"
          title="Ajouter un ami"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6 21v-2a4 4 0 0 1 4 -4h4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M16 19h6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19 16v6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {channels.length ? (
          channels.map((channel) => (
            <button
              key={channel.id}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                selectedChannel === channel.id
                  ? "border-[var(--brand-1)] bg-[rgba(0,212,255,0.12)] text-white"
                  : "border-[var(--stroke)] bg-[var(--surface-strong)] text-slate-200 hover:bg-[var(--surface)]"
              }`}
              onClick={() => onSelectChannel(channel.id)}
              type="button"
            >
              <span className="truncate">#{channel.name}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Actif
              </span>
            </button>
          ))
        ) : (
          <p className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
            Aucun channel pour ce serveur.
          </p>
        )}
      </div>
    </section>
  );
}
