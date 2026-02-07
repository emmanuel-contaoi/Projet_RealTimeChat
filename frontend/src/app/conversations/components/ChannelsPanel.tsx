import type { Channel } from "../types";

type ChannelsPanelProps = {
  channels: Channel[];
  selectedChannel: string;
  canManageChannels: boolean;
  onSelectChannel: (channelId: string) => void;
  onDeleteChannel: (channelId: string) => void;
  onUpdateChannel: (channelId: string, newName: string) => void;
  onCreateChannel: () => void;
};

export default function ChannelsPanel({
  channels,
  selectedChannel,
  canManageChannels,
  onSelectChannel,
  onDeleteChannel,
  onUpdateChannel,
  onCreateChannel,
}: ChannelsPanelProps) {
  const handleDelete = (e: React.MouseEvent, channelId: string) => {
    e.stopPropagation();
    onDeleteChannel(channelId);
  };

  const handleRename = (e: React.MouseEvent, channelId: string, currentName: string) => {
    e.stopPropagation();
    const newName = prompt("Nouveau nom du channel :", currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      onUpdateChannel(channelId, newName.trim());
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex shrink-0 items-center justify-between">
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
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
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
                  <span className="ml-2 flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      className="rounded-full p-1 text-slate-600 transition hover:text-[var(--brand-1)]"
                      onClick={(e) => handleRename(e, channel.id, channel.name)}
                      title="Renommer ce channel"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="rounded-full p-1 text-slate-600 transition hover:text-red-400"
                      onClick={(e) => handleDelete(e, channel.id)}
                      title="Supprimer ce channel"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </span>
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
