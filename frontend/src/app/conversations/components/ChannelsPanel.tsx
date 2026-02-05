type ChannelsPanelProps = {
  channels: string[];
  selectedChannel: string;
  onSelectChannel: (channel: string) => void;
};

export default function ChannelsPanel({
  channels,
  selectedChannel,
  onSelectChannel,
}: ChannelsPanelProps) {
  return (
    <section className="h-full rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Channels</p>
        <span className="text-xs text-slate-400">{channels.length}</span>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {channels.length ? (
          channels.map((channel) => (
            <button
              key={channel}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                selectedChannel === channel
                  ? "border-[var(--brand-1)] bg-[rgba(0,212,255,0.12)] text-white"
                  : "border-[var(--stroke)] bg-[var(--surface-strong)] text-slate-200 hover:bg-[var(--surface)]"
              }`}
              onClick={() => onSelectChannel(channel)}
              type="button"
            >
              <span className="truncate">#{channel}</span>
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
