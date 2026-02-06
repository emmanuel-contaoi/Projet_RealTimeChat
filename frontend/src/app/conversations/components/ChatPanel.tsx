import { useState } from "react";
import type { FormEvent } from "react";
import type { ChannelMessage } from "../types";

type ChatPanelProps = {
  selectedChannel: string;
  selectedServer: string;
  messages: ChannelMessage[];
  currentUserId: string;
  onSendMessage: (content: string) => void;
};

export default function ChatPanel({
  selectedChannel,
  selectedServer,
  messages,
  currentUserId,
  onSendMessage,
}: ChatPanelProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !selectedChannel) return;
    onSendMessage(trimmed);
    setInput("");
  };

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

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {selectedChannel && messages.length ? (
          messages.map((message, index) => {
            const isMe = message.user_id === currentUserId;
            return (
              <div
                key={message.id ?? `${message.user_id}-${index}`}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                    isMe
                      ? "bg-[var(--brand-1)] text-slate-900"
                      : "bg-[var(--surface-strong)] text-slate-200"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    {message.username}
                  </p>
                  <p>{message.content}</p>
                  {message.created_at && (
                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
            Aucun message dans ce channel.
          </p>
        )}
      </div>

      <form
        className="flex items-center gap-3 border-t border-[var(--stroke)] px-5 py-4"
        onSubmit={handleSubmit}
      >
        <input
          className="flex-1 rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-white outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-1)]"
          placeholder="Ecris un message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!selectedChannel}
        />
        <button
          type="submit"
          className="rounded-full bg-[var(--brand-1)] px-5 py-2.5 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!selectedChannel || !input.trim()}
        >
          Envoyer
        </button>
      </form>
    </section>
  );
}
