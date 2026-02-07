import type { Channel } from "../types";

type ChannelsPanelProps = {
  channels: Channel[];
  selectedChannel: string;
  canManageChannels: boolean;
  onSelectChannel: (channelId: string) => void;
  onDeleteChannel: (channelId: string) => void;
  onCreateChannel: () => void;
};

export default function ChannelsPanel({
  channels,
  selectedChannel,
  canManageChannels,
  onSelectChannel,
  onDeleteChannel,
  onCreateChannel,
}: ChannelsPanelProps) {
  const handleDelete = (e: React.MouseEvent, channelId: string) => {
    e.stopPropagation();
    onDeleteChannel(channelId);
  };

  return (
    <section className="h-full rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Channels</p>
        {canManageChannels && (
          <button
            type="button"
            className="rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-1 text-[11px] text-[var(--brand-1)] transition hover:bg-[var(--surface)]"
            onClick={onCreateChannel}
          >
            + Ajouter
          </button>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {channels.length ? (
          channels.map((channel) => {
            const isActive = selectedChannel === channel.id;
            return (
              <div
                key={channel.id}
                className={`group flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-semibold transition cursor-pointer ${
                  isActive
                    ? "border-[var(--brand-1)] bg-[rgba(0,212,255,0.10)] text-white"
                    : "border-[var(--stroke)] bg-[var(--surface-strong)] text-slate-300 hover:border-[rgba(0,212,255,0.3)] hover:bg-[var(--surface)] hover:text-white"
                }`}
                onClick={() => onSelectChannel(channel.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSelectChannel(channel.id);
                }}
              >
                <span className="truncate"># {channel.name}</span>
                {canManageChannels && (
                  <button
                    type="button"
                    className="ml-2 shrink-0 rounded-full p-1 text-slate-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                    onClick={(e) => handleDelete(e, channel.id)}
                    title="Supprimer ce channel"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
            Aucun channel pour ce serveur.
          </p>
        )}
      </div>
    </section>
  );
}
