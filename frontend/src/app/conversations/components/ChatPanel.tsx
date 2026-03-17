import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import type { ChannelMessage } from "../types";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { gifService } from "@/services/api";
import type { GifItem } from "@/services/api";

type ChatPanelProps = {
  channelName: string;
  selectedChannel: string;
  selectedServer: string;
  messages: ChannelMessage[];
  currentUserId: string;
  currentUserRole: string;
  typingUsers: string[];
  onSendMessage: (content: string) => void;
  onTyping: () => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
};

const isGifUrl = (value: string) => {
  if (!/^https?:\/\//i.test(value)) return false;
  const url = value.toLowerCase();
  return (
    url.includes(".gif") ||
    url.includes("giphy.com/media/") ||
    url.includes("media.giphy.com/") ||
    url.includes("tenor.com/")
  );
};

// Affiche les messages du channel et le formulaire pour envoyer
export default function ChatPanel({
  channelName,
  selectedChannel,
  selectedServer,
  messages,
  currentUserId,
  currentUserRole,
  typingUsers,
  onSendMessage,
  onTyping,
  onEditMessage,
  onDeleteMessage,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState<GifItem[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const gifPickerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Envoie le message quand on appuie sur entree
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !selectedChannel) return;
    onSendMessage(trimmed);
    setInput("");
  };

  // Met a jour l'input et notifie les autres qu'on est en train d'ecrire
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (e.target.value.trim()) {
      onTyping();
    }
  };

  // Ferme les pickers si on clique en dehors
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (gifPickerRef.current && !gifPickerRef.current.contains(e.target as Node)) {
        setShowGifPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Charge les GIFs trending/recherche quand le panel est ouvert
  useEffect(() => {
    if (!showGifPicker) return;

    if (!gifService.isConfigured()) {
      setGifResults([]);
      setGifLoading(false);
      setGifError("Ajoute NEXT_PUBLIC_GIPHY_API_KEY dans frontend/.env.local");
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setGifLoading(true);
      setGifError("");
      try {
        const query = gifSearch.trim();
        const data = query
          ? await gifService.search(query, 24)
          : await gifService.trending(24);
        if (!cancelled) {
          setGifResults(data);
        }
      } catch {
        if (!cancelled) {
          setGifResults([]);
          setGifError("Impossible de charger les GIFs pour le moment.");
        }
      } finally {
        if (!cancelled) {
          setGifLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showGifPicker, gifSearch]);

  // Scroll automatique vers le dernier message
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
            const canDelete = isMe || currentUserRole === "owner" || currentUserRole === "admin";

            // Séparateur de date : affiché avant le premier message d'un nouveau jour
            let showDateSeparator = false;
            if (message.created_at) {
              const msgDate = new Date(message.created_at).toDateString();
              const prevDate = index > 0 && messages[index - 1].created_at
                ? new Date(messages[index - 1].created_at!).toDateString()
                : null;
              showDateSeparator = index === 0 || msgDate !== prevDate;
            }

            return (
              <div key={message.id ?? `${message.user_id}-${index}`} className="flex flex-col gap-3">
                {showDateSeparator && message.created_at && (
                  <div className="flex items-center gap-4 py-2">
                    <div className="h-px flex-1 bg-[var(--stroke)]" />
                    <span className="text-[11px] font-medium text-slate-500">
                      {new Date(message.created_at).toLocaleDateString("fr-FR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <div className="h-px flex-1 bg-[var(--stroke)]" />
                  </div>
                )}
              <div
                className={`group flex items-end gap-1.5 ${isMe ? "justify-end" : "justify-start"}`}
              >
                {isMe && message.id && editingId !== message.id && (
                  <div className="hidden items-center gap-1 pb-1 group-hover:flex">
                    <button
                      type="button"
                      className="rounded-full p-1 text-slate-500 transition hover:text-blue-400"
                      onClick={() => { setEditingId(message.id!); setEditContent(message.content); }}
                      title="Modifier ce message"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="rounded-full p-1 text-slate-500 transition hover:text-red-400"
                      onClick={() => onDeleteMessage(message.id!)}
                      title="Supprimer ce message"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}
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
                  {editingId === message.id ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (editContent.trim() && message.id) {
                          onEditMessage(message.id, editContent.trim());
                          setEditingId(null);
                        }
                      }}
                    >
                      <input
                        className="flex-1 rounded-lg bg-[rgba(0,0,0,0.2)] px-2 py-1 text-sm text-white outline-none"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Escape") setEditingId(null); }}
                      />
                      <button type="submit" className="text-[10px] text-green-400 hover:text-green-300">OK</button>
                      <button type="button" className="text-[10px] text-slate-400 hover:text-slate-300" onClick={() => setEditingId(null)}>Annuler</button>
                    </form>
                  ) : (
                    isGifUrl(message.content) ? (
                      <Image
                        src={message.content}
                        alt="GIF"
                        width={400}
                        height={256}
                        unoptimized
                        className="max-h-64 w-auto rounded-xl object-contain"
                      />
                    ) : (
                      <p className="break-all">{message.content}</p>
                    )
                  )}
                  {message.created_at && (
                    <p className={`mt-1 text-[10px] ${isMe ? "text-slate-900/50" : "text-slate-500"}`}>
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
                {!isMe && message.id && editingId !== message.id && canDelete && (
                  <div className="hidden items-center pb-1 group-hover:flex">
                    <button
                      type="button"
                      className="rounded-full p-1 text-slate-500 transition hover:text-red-400"
                      onClick={() => onDeleteMessage(message.id!)}
                      title="Supprimer ce message"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
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
        <div className="relative" ref={emojiPickerRef}>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] text-lg transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            disabled={!selectedChannel}
            title="Emojis"
          >
            😊
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-12 right-0 z-50">
              <EmojiPicker
                theme={Theme.DARK}
                onEmojiClick={(emojiData) => {
                  setInput((prev) => prev + emojiData.emoji);
                  setShowEmojiPicker(false);
                }}
                width={320}
                height={400}
                searchPlaceHolder="Rechercher..."
              />
            </div>
          )}
        </div>
        <div className="relative" ref={gifPickerRef}>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] text-[11px] font-semibold tracking-wide transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              setShowGifPicker((prev) => !prev);
              setShowEmojiPicker(false);
            }}
            disabled={!selectedChannel}
            title="GIF"
          >
            GIF
          </button>
          {showGifPicker && (
            <div className="absolute bottom-12 right-0 z-50 w-[340px] rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-3 shadow-[0_14px_30px_rgba(6,10,20,0.6)]">
              <input
                className="mb-3 w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[var(--brand-1)]"
                placeholder="Rechercher un GIF..."
                value={gifSearch}
                onChange={(e) => setGifSearch(e.target.value)}
              />
              {gifError ? (
                <p className="py-4 text-center text-xs text-rose-300">{gifError}</p>
              ) : gifLoading ? (
                <p className="py-4 text-center text-xs text-slate-400">Chargement des GIFs...</p>
              ) : gifResults.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-400">Aucun GIF trouve.</p>
              ) : (
                <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
                  {gifResults.map((gif) => (
                    <button
                      key={gif.id}
                      type="button"
                      className="overflow-hidden rounded-lg border border-[var(--stroke)] transition hover:border-[var(--brand-1)]"
                      onClick={() => {
                        onSendMessage(gif.url);
                        setShowGifPicker(false);
                        setGifSearch("");
                      }}
                      title={gif.title}
                    >
                      <Image
                        src={gif.previewUrl}
                        alt={gif.title}
                        width={gif.width || 200}
                        height={gif.height || 112}
                        unoptimized
                        className="h-28 w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
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
