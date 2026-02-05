import type { ChannelMessage } from "../types";

type ChatPanelProps = {
  selectedChannel: string;
  selectedServer: string;
  messages: ChannelMessage[];
};

export default function ChatPanel({
  selectedChannel,
  selectedServer,
  messages,
}: ChatPanelProps) {
  return (
    <section className="flex h-full flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex items-center justify-between border-b border-[var(--stroke)] px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-white">
            {selectedChannel ? `#${selectedChannel}` : "Conversation"}
          </p>
          <p className="text-xs text-slate-400">
            {selectedServer || "Aucun serveur"}
          </p>
        </div>
        <span className="rounded-full bg-[rgba(0,212,255,0.2)] px-2 py-1 text-[10px] font-semibold text-[var(--brand-1)]">
          Actif
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 py-4">
        {selectedChannel && messages.length ? (
          messages.map((message, index) => (
            <div
              key={`${message.sender}-${index}`}
              className={`flex ${message.me ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  message.me
                    ? "bg-[var(--brand-1)] text-slate-900"
                    : "bg-[var(--surface-strong)] text-slate-200"
                }`}
              >
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  {message.sender}
                </p>
                <p>{message.text}</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {message.time}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
            Aucun message dans ce channel.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--stroke)] px-5 py-4">
        <div className="flex-1 rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
          Ecris un message...
        </div>
        <button
          className="rounded-full bg-[var(--brand-1)] px-5 py-2.5 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!selectedChannel}
        >
          Envoyer
        </button>
      </div>
    </section>
  );
}
