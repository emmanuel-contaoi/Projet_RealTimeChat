"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { gifService } from "@/services/api";
import type { GifItem } from "@/services/api";
import type { ChannelMessage } from "../types";
import { isGifUrl } from "../utils";

type ChatPanelProps = {
  channelName: string;
  selectedChannel: string;
  selectedServer: string;
  messages: ChannelMessage[];
  currentUserId: string;
  currentUserRole: string;
  typingUsers: string[];
  isDm?: boolean;
  friendStatus?: string;
  onSendMessage: (content: string) => void;
  onTyping: () => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
};

type MessageGroup = {
  id: string;
  showDateSeparator: boolean;
  items: ChannelMessage[];
};

const getColorFromName = (name: string) => {
  const colors = [
    "from-rose-500 to-fuchsia-500",
    "from-blue-500 to-cyan-400",
    "from-emerald-500 to-teal-400",
    "from-amber-500 to-orange-400",
    "from-violet-500 to-purple-500",
    "from-sky-500 to-blue-400",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function ChatPanel({
  channelName,
  selectedChannel,
  selectedServer,
  messages,
  currentUserId,
  currentUserRole,
  typingUsers,
  isDm,
  friendStatus,
  onSendMessage,
  onTyping,
  onEditMessage,
  onDeleteMessage,
  onAddReaction,
  onRemoveReaction,
}: ChatPanelProps) {
  const t = useTranslations("chat");
  const tc = useTranslations("common");

  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState<GifItem[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [reactionPickerDirection, setReactionPickerDirection] = useState<"up" | "down">("up");
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const gifPickerRef = useRef<HTMLDivElement | null>(null);
  const reactionPickerRef = useRef<HTMLDivElement | null>(null);
  const messageMenuRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !selectedChannel) return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (e.target.value.trim()) onTyping();
  };

  const hasReacted = (message: ChannelMessage, emoji: string) => {
    if (!message.reactions) return false;
    return message.reactions.some(
      (reaction) =>
        reaction.emoji === emoji &&
        reaction.user_ids &&
        reaction.user_ids.includes(currentUserId),
    );
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (gifPickerRef.current && !gifPickerRef.current.contains(e.target as Node)) {
        setShowGifPicker(false);
      }
      if (
        reactionPickerRef.current &&
        !reactionPickerRef.current.contains(e.target as Node)
      ) {
        setReactionPickerMessageId(null);
      }
      if (messageMenuRef.current && !messageMenuRef.current.contains(e.target as Node)) {
        setOpenMessageMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setReactionPickerMessageId(null);
    setOpenMessageMenuId(null);
  }, [selectedChannel]);

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
        if (!cancelled) setGifResults(data);
      } catch {
        if (!cancelled) {
          setGifResults([]);
          setGifError(t("gif_error"));
        }
      } finally {
        if (!cancelled) setGifLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showGifPicker, gifSearch]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const inputPlaceholder = channelName
    ? t("placeholder_channel", { channelName })
    : t("placeholder");
  const messageGroups = messages.reduce<MessageGroup[]>((groups, message, index) => {
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const currentDate = message.created_at
      ? new Date(message.created_at).toDateString()
      : null;
    const prevDate = prevMessage?.created_at
      ? new Date(prevMessage.created_at).toDateString()
      : null;
    const showDateSeparator = index === 0 || currentDate !== prevDate;
    const shouldStartNewGroup =
      showDateSeparator || !prevMessage || prevMessage.user_id !== message.user_id;

    if (shouldStartNewGroup) {
      groups.push({
        id: message.id ?? `${message.user_id}-${index}`,
        showDateSeparator,
        items: [message],
      });
      return groups;
    }

    groups[groups.length - 1].items.push(message);
    return groups;
  }, []);

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--panel)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(36,52,75,0.72)] bg-[rgba(20,28,39,0.9)] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          
          {/* HEADER MODIFIÉ SELON isDm */}
          {isDm ? (
            <div className="relative">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${getColorFromName(channelName || "A")} text-[1.1rem] font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]`}>
                {(channelName || "A").charAt(0).toUpperCase()}
              </div>
              <span
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[rgba(20,28,39,0.9)] ${
                  friendStatus === "En ligne" ? "bg-[var(--success)]" : "bg-slate-500"
                }`}
              />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[rgba(21,209,255,0.45)] bg-[rgba(21,209,255,0.08)] text-[1.45rem] font-semibold text-[var(--brand-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              #
            </div>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* CORRECTION ICI : Affiche le nom de l'ami si DM, sinon fallback sur t("select_channel") */}
              <p className="truncate text-[1.7rem] font-semibold leading-none text-white">
                {isDm ? channelName : (channelName || t("select_channel"))}
              </p>
              {selectedChannel && !isDm ? (
                <span className="rounded-lg border border-[rgba(21,209,255,0.35)] bg-[rgba(21,209,255,0.12)] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-1)]">
                  Public
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {isDm 
                ? (friendStatus === "En ligne" ? "Actif maintenant" : "Hors ligne")
                : (selectedServer ? `Bienvenue sur ${selectedServer}` : t("select_channel"))
              }
            </p>
          </div>
        </div>
      </div>

      {/* ZONE DES MESSAGES */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {selectedChannel && messages.length ? (
          <div className="px-2">
            {messageGroups.map((group) => {
              const firstMessage = group.items[0];
              const isMe = firstMessage.user_id === currentUserId;
              const displayName = isMe ? t("me") : firstMessage.username || "Utilisateur";
              const avatarInitial = displayName.charAt(0).toUpperCase();
              const avatarColor = getColorFromName(firstMessage.username || "User");

              return (
                <div key={group.id} className={group.showDateSeparator ? "space-y-3" : "pt-3"}>
                  {group.showDateSeparator && firstMessage.created_at ? (
                    <div className="flex items-center gap-4 py-1 my-2">
                      <div className="h-px flex-1 bg-[rgba(74,97,127,0.25)]" />
                      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
                        {new Date(firstMessage.created_at).toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                      <div className="h-px flex-1 bg-[rgba(74,97,127,0.25)]" />
                    </div>
                  ) : null}

                  <div className={`group relative flex w-full ${isMe ? "justify-end" : "justify-start"} mx-2 px-3 py-2 rounded-xl transition-all duration-300 hover:bg-white/[0.04] mb-1`}>
                    <article className="overflow-visible max-w-[75%] relative">
                      <div className={`flex items-start gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}>
                        <div className="relative shrink-0">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${avatarColor} text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(0,0,0,0.22)]`}>
                            {avatarInitial}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className={`mb-1.5 flex flex-wrap items-center gap-2 ${isMe ? "justify-end" : ""}`}>
                            {isMe && firstMessage.created_at ? (
                              <span className="text-[11px] text-slate-500">
                                {new Date(firstMessage.created_at).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            ) : null}
                            {isMe ? (
                              <span className="rounded-lg border border-[rgba(21,209,255,0.3)] bg-[rgba(21,209,255,0.14)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-1)]">
                                Vous
                              </span>
                            ) : null}
                            <p className="text-[0.94rem] font-semibold leading-none text-white">{displayName}</p>
                            {!isMe && firstMessage.created_at ? (
                              <span className="text-[11px] text-slate-500">
                                {new Date(firstMessage.created_at).toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            {group.items.map((message, messageIndex) => {
                              const canDelete =
                                message.user_id === currentUserId ||
                                currentUserRole === "owner" ||
                                currentUserRole === "admin";

                              return (
                                <div
                                  key={message.id ?? `${message.user_id}-${messageIndex}`}
                                  className={`group/message flex items-center gap-2 ${isMe ? "flex-row-reverse" : ""} ${messageIndex > 0 ? "pt-1" : ""}`}
                                >
                                  <div className="min-w-0 flex-1">
                                  {editingId === message.id ? (
                                    <form
                                      className="flex flex-col gap-3"
                                      onSubmit={(event) => {
                                        event.preventDefault();
                                        if (editContent.trim() && message.id) {
                                          onEditMessage(message.id, editContent.trim());
                                          setEditingId(null);
                                          setOpenMessageMenuId(null);
                                        }
                                      }}
                                    >
                                      <input
                                        className="w-full rounded-[12px] border border-[var(--stroke)] bg-[rgba(10,16,24,0.9)] px-3 py-2 text-sm text-white outline-none"
                                        value={editContent}
                                        onChange={(event) => setEditContent(event.target.value)}
                                        autoFocus
                                        onKeyDown={(event) => {
                                          if (event.key === "Escape") setEditingId(null);
                                        }}
                                      />
                                      <div className="flex items-center gap-3 text-[11px]">
                                        <button type="submit" className="font-semibold text-emerald-400 transition hover:text-emerald-300">
                                          {t("emoji_ok")}
                                        </button>
                                        <button
                                          type="button"
                                          className="text-slate-400 transition hover:text-slate-300"
                                          onClick={() => setEditingId(null)}
                                        >
                                          {tc("cancel")}
                                        </button>
                                      </div>
                                    </form>
                                  ) : isGifUrl(message.content) ? (
                                    <Image
                                      src={message.content}
                                      alt="GIF"
                                      width={256}
                                      height={256}
                                      className="max-h-44 w-auto rounded-[16px] object-contain"
                                      unoptimized
                                    />
                                  ) : (
                                    <p className="whitespace-pre-wrap break-words text-[0.86rem] leading-relaxed text-slate-100">
                                      {message.content}
                                    </p>
                                  )}

                                  {message.id && message.reactions?.length ? (
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                      {message.reactions?.map((reaction) => {
                                        const reactedByMe = hasReacted(message, reaction.emoji);
                                        return (
                                          <button
                                            key={`${message.id}-${reaction.emoji}`}
                                            type="button"
                                            className={`inline-flex h-7.5 items-center gap-1.5 rounded-full border px-2.5 text-[10px] transition ${
                                              reactedByMe
                                                ? "border-[rgba(21,209,255,0.32)] bg-[rgba(21,209,255,0.12)] text-white"
                                                : "border-[rgba(80,102,133,0.72)] bg-[rgba(37,49,69,0.92)] text-slate-200 hover:border-[rgba(120,146,184,0.9)]"
                                            }`}
                                            onClick={() => {
                                              if (reactedByMe) {
                                                onRemoveReaction(message.id!, reaction.emoji);
                                              } else {
                                                onAddReaction(message.id!, reaction.emoji);
                                              }
                                            }}
                                            title={reactedByMe ? t("remove_reaction") : t("add_reaction")}
                                          >
                                            <span className="text-[13px] leading-none">{reaction.emoji}</span>
                                            <span className="font-semibold">
                                              {reaction.user_ids?.length || 0}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                  </div>

                                  {message.id && editingId !== message.id ? (
                                    <div
                                      className={`relative shrink-0 transition ${reactionPickerMessageId === message.id ? "opacity-100" : "opacity-0 group-hover/message:opacity-100"}`}
                                      ref={reactionPickerMessageId === message.id ? reactionPickerRef : null}
                                    >
                                      <button
                                        type="button"
                                        className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[10px] transition ${
                                          reactionPickerMessageId === message.id
                                            ? "border-[rgba(21,209,255,0.32)] bg-[rgba(21,209,255,0.12)] text-white"
                                            : "border-[rgba(80,102,133,0.72)] bg-[rgba(37,49,69,0.92)] text-slate-300 hover:border-[rgba(120,146,184,0.9)] hover:text-white"
                                        }`}
                                        onClick={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setReactionPickerDirection(rect.bottom > window.innerHeight / 2 ? "up" : "down");
                                          setReactionPickerMessageId((prev) => prev === message.id ? null : message.id!);
                                        }}
                                        title={t("add_reaction")}
                                      >
                                        <span className="text-[13px] leading-none">+</span>
                                        <span>Reaction</span>
                                      </button>
                                      {reactionPickerMessageId === message.id ? (
                                        <div className={`absolute z-[100] ${reactionPickerDirection === "up" ? "bottom-full mb-2" : "top-full mt-2"} ${isMe ? "right-0" : "left-0"}`}>
                                          <div className="w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[18px] border border-[rgba(80,102,133,0.78)] bg-[rgba(25,31,41,0.98)] shadow-[0_18px_40px_rgba(2,8,18,0.45)]">
                                            <EmojiPicker
                                              theme={Theme.DARK}
                                              onEmojiClick={(emojiData) => {
                                                onAddReaction(message.id!, emojiData.emoji);
                                                setReactionPickerMessageId(null);
                                              }}
                                              width="100%"
                                              height={360}
                                              searchPlaceHolder={t("emoji_search")}
                                            />
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  {message.id && editingId !== message.id && canDelete ? (
                                    <div
                                      className={`relative shrink-0 transition ${
                                        openMessageMenuId === message.id ? "opacity-100" : "opacity-0 group-hover/message:opacity-100"
                                      }`}
                                      ref={openMessageMenuId === message.id ? messageMenuRef : null}
                                    >
                                      <button
                                        type="button"
                                        className="flex h-7.5 w-7.5 items-center justify-center rounded-[10px] bg-[rgba(47,61,84,0.96)] text-slate-300 transition hover:bg-[rgba(60,77,104,0.96)] hover:text-white"
                                        onClick={() => {
                                          setOpenMessageMenuId((prev) => (prev === message.id ? null : message.id!));
                                        }}
                                        title="Options"
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                          <circle cx="12" cy="5" r="1.7" />
                                          <circle cx="12" cy="12" r="1.7" />
                                          <circle cx="12" cy="19" r="1.7" />
                                        </svg>
                                      </button>

                                      {openMessageMenuId === message.id ? (
                                        <div className={`absolute top-10 z-[100] min-w-[150px] rounded-[16px] border border-[var(--stroke)] bg-[rgba(12,19,29,0.98)] p-1.5 shadow-[0_20px_40px_rgba(2,8,18,0.42)] ${isMe ? "right-0" : "left-0"}`}>
                                          {message.user_id === currentUserId ? (
                                            <button
                                              type="button"
                                              className="flex w-full items-center rounded-[12px] px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-[rgba(21,209,255,0.1)] hover:text-white"
                                              onClick={() => {
                                                setEditingId(message.id!);
                                                setEditContent(message.content);
                                                setOpenMessageMenuId(null);
                                              }}
                                            >
                                              {t("edit")}
                                            </button>
                                          ) : null}

                                          <button
                                            type="button"
                                            className="flex w-full items-center rounded-[12px] px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-[rgba(255,84,109,0.12)] hover:text-white"
                                            onClick={() => {
                                              onDeleteMessage(message.id!);
                                              setOpenMessageMenuId(null);
                                            }}
                                          >
                                            {t("delete")}
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>

                        </div>
                      </div>
                    </article>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-[320px] items-center justify-center">
            <p className="text-sm font-medium text-slate-500 bg-slate-800/30 px-6 py-3 rounded-full border border-slate-700/30">
              {isDm ? "Aucun message pour l'instant." : (selectedChannel ? t("no_messages") : t("select_channel"))}
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* BARRE DU BAS RESPONSIVE */}
      <div className="relative z-50 border-t border-[rgba(36,52,75,0.72)] bg-[rgba(17,24,35,0.96)] px-3 py-3.5 sm:px-4 backdrop-blur-md">
        {typingUsers.length > 0 ? (
          <div className="mb-4 text-xs font-medium text-slate-400">
            <span className="inline-flex items-center gap-2.5 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
              <span className="flex gap-1.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand-1)] [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand-1)] [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--brand-1)] [animation-delay:300ms]" />
              </span>
              {typingUsers.length === 1
                ? t("typing_one", { username: typingUsers[0] })
                : t("typing_many", { usernames: typingUsers.join(", ") })}
            </span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 sm:gap-3">
            
            <div className="min-w-0 flex-1 rounded-[16px] border border-slate-700/60 bg-[rgba(26,37,53,0.7)] px-3 sm:px-4 py-2 sm:py-3 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] transition-colors focus-within:border-[var(--brand-1)]/50 focus-within:bg-[rgba(26,37,53,0.9)]">
              <input
                className="w-full bg-transparent text-[0.95rem] text-white outline-none placeholder:text-slate-500"
                placeholder={inputPlaceholder}
                value={input}
                onChange={handleInputChange}
                disabled={!selectedChannel}
              />
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-[12px] sm:rounded-[14px] border border-slate-700/60 bg-slate-800/50 text-[18px] transition-all hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 hover:scale-105 active:scale-95"
                  onClick={() => {
                    setShowEmojiPicker((prev) => !prev);
                    setShowGifPicker(false);
                  }}
                  disabled={!selectedChannel}
                  title="Emojis"
                >
                  😊
                </button>
                {showEmojiPicker ? (
                  <div className="fixed bottom-[80px] left-1/2 z-[100] -translate-x-1/2 sm:absolute sm:bottom-14 sm:left-auto sm:right-0 sm:translate-x-0 sm:z-[100] shadow-2xl">
                    <div className="w-[320px] max-w-[calc(100vw-2rem)] rounded-[20px] overflow-hidden border border-slate-700/60 bg-[rgba(20,25,35,0.98)]">
                      <EmojiPicker
                        theme={Theme.DARK}
                        onEmojiClick={(emojiData) => {
                          setInput((prev) => prev + emojiData.emoji);
                          setShowEmojiPicker(false);
                        }}
                        width="100%"
                        height={400}
                        searchPlaceHolder={t("emoji_search")}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="relative" ref={gifPickerRef}>
                <button
                  type="button"
                  className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-[12px] sm:rounded-[14px] border border-slate-700/60 bg-slate-800/50 transition-all hover:border-slate-500 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 hover:scale-105 active:scale-95 text-slate-300 hover:text-[var(--brand-1)]"
                  onClick={() => {
                    setShowGifPicker((prev) => !prev);
                    setShowEmojiPicker(false);
                  }}
                  disabled={!selectedChannel}
                  title="GIF"
                >
                  <span className="text-[11px] sm:text-[12px] font-bold tracking-wider">GIF</span>
                </button>
                {showGifPicker ? (
                  <div className="fixed bottom-[80px] left-1/2 z-[100] w-[340px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-[24px] border border-slate-700/60 bg-[rgba(15,22,33,0.98)] p-3 shadow-[0_24px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:absolute sm:bottom-14 sm:left-auto sm:right-0 sm:translate-x-0 sm:z-[100]">
                    <input
                      className="mb-3 w-full rounded-[16px] border border-slate-700 bg-[rgba(25,35,50,0.8)] px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[var(--brand-1)]/50 transition-colors"
                      placeholder={t("gif_search_placeholder")}
                      value={gifSearch}
                      onChange={(event) => setGifSearch(event.target.value)}
                    />
                    {gifError ? (
                      <p className="py-6 text-center text-sm font-medium text-rose-400">{gifError}</p>
                    ) : gifLoading ? (
                      <div className="py-8 flex justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-[var(--brand-1)]" />
                      </div>
                    ) : gifResults.length === 0 ? (
                      <p className="py-6 text-center text-sm font-medium text-slate-400">{t("gif_empty")}</p>
                    ) : (
                      <div className="grid max-h-[300px] grid-cols-2 gap-2.5 overflow-y-auto pr-1">
                        {gifResults.map((gif) => (
                          <button
                            key={gif.id}
                            type="button"
                            className="overflow-hidden rounded-[14px] border border-transparent transition-all hover:border-[var(--brand-1)] hover:shadow-[0_0_15px_rgba(21,209,255,0.2)] hover:scale-[1.02] active:scale-95 bg-slate-800/50"
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
                              width={112}
                              height={112}
                              className="h-28 w-full object-cover"
                              unoptimized
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <button
                type="submit"
                className="hidden h-11 items-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,_var(--brand-1),_#2958d3)] px-5 text-[14px] font-bold tracking-wide text-white transition-all hover:brightness-110 hover:shadow-[0_0_20px_rgba(21,209,255,0.4)] hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none md:inline-flex"
                disabled={!selectedChannel || !input.trim()}
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13" />
                  <path d="m22 2-7 20-4-9-9-4Z" />
                </svg>
                {t("send")}
              </button>

              <button
                type="submit"
                className="inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-[12px] sm:rounded-[14px] bg-[linear-gradient(135deg,_var(--brand-1),_#2958d3)] text-white transition-all hover:brightness-110 hover:shadow-[0_0_15px_rgba(21,209,255,0.4)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 md:hidden"
                disabled={!selectedChannel || !input.trim()}
              >
                <svg aria-hidden="true" className="h-4 w-4 relative -left-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13" />
                  <path d="m22 2-7 20-4-9-9-4Z" />
                </svg>
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}