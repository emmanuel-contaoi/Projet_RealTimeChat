import { useState, useRef, useEffect } from "react";
import type { FormEvent } from "react";
import type { ChannelMessage } from "../types";

type ChatPanelProps = {
  channelName: string;
  selectedChannel: string;
  selectedServer: string;
  messages: ChannelMessage[];
  currentUserId: string;
  typingUsers: string[];
  onSendMessage: (content: string) => void;
  onTyping: () => void;
};

export default function ChatPanel({
  channelName,
  selectedChannel,
  selectedServer,
  messages,
  currentUserId,
  typingUsers,
  onSendMessage,
  onTyping,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !selectedChannel) return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (e.target.value.trim()) {
      onTyping();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex items-center justify-between border-b border-[var(--stroke)] px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-white">
            {channelName ? `# ${channelName}` : "Conversation"}
          </p>
          <p className="text-xs text-slate-400">
            {selectedServer || "Aucun serveur"}
          </p>
        </div>
        {selectedChannel && (
          <span className="rounded-full bg-[rgba(0,212,255,0.15)] px-3 py-1 text-[10px] font-semibold tracking-wide text-[var(--brand-1)]">
            En ligne
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
        {selectedChannel && messages.length ? (
          messages.map((message, index) => {
            const isMe = message.user_id === currentUserId;
            return (
              <div
                key={message.id ?? `${message.user_id}-${index}`}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isMe
                      ? "bg-[var(--brand-1)] text-slate-900"
                      : "bg-[var(--surface-strong)] text-slate-200"
                  }`}
                >
                  {!isMe && (
                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--brand-1)]">
                      {message.username}
                    </p>
                  )}
                  <p>{message.content}</p>
                  {message.created_at && (
                    <p className={`mt-1 text-[10px] ${isMe ? "text-slate-700" : "text-slate-500"}`}>
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
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-slate-500">
              {selectedChannel ? "Aucun message pour l'instant." : "Selectionnez un channel."}
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="px-6 pb-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
            </span>
            {typingUsers.length === 1
              ? `${typingUsers[0]} ecrit...`
              : `${typingUsers.join(", ")} ecrivent...`}
          </span>
        </div>
      )}

      <form
        className="flex items-center gap-3 border-t border-[var(--stroke)] px-6 py-4"
        onSubmit={handleSubmit}
      >
        <input
          className="flex-1 rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] px-5 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[var(--brand-1)]"
          placeholder="Ecris un message..."
          value={input}
          onChange={handleInputChange}
          disabled={!selectedChannel}
        />
        <button
          type="submit"
          className="rounded-full bg-[var(--brand-1)] px-6 py-3 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          disabled={!selectedChannel || !input.trim()}
        >
          Envoyer
        </button>
      </form>
    </section>
  );
}
