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
          setGifError("Impossible de charger les GIFs pour le moment.");
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
    ? `Écris un message dans #${channelName}...`
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
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[rgba(21,209,255,0.45)] bg-[rgba(21,209,255,0.08)] text-[1.45rem] font-semibold text-[var(--brand-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            #
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="truncate text-[1.7rem] font-semibold leading-none text-white">
                {channelName || t("select_channel")}
              </p>
              {selectedChannel ? (
                <span className="rounded-lg border border-[rgba(21,209,255,0.35)] bg-[rgba(21,209,255,0.12)] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-1)]">
                  Public
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {selectedServer ? `Bienvenue sur ${selectedServer}` : t("select_channel")}
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {selectedChannel && messages.length ? (
          <div>
            {messageGroups.map((group) => {
              const firstMessage = group.items[0];
              const reactionTargetMessage = [...group.items].reverse().find((item) => item.id);
              const isMe = firstMessage.user_id === currentUserId;
              const displayName = isMe ? "Moi" : firstMessage.username || "Utilisateur";
              const avatarInitial = displayName.charAt(0).toUpperCase();
              const avatarColor = getColorFromName(firstMessage.username || "User");

              return (
                <div key={group.id} className={group.showDateSeparator ? "space-y-3" : "pt-3"}>
                  {group.showDateSeparator && firstMessage.created_at ? (
                    <div className="flex items-center gap-4 py-1">
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

                  <article className="overflow-visible rounded-[16px] bg-[rgba(23,32,45,0.98)] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                    <div className="flex gap-2.5">
                      <div className="relative shrink-0">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${avatarColor} text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(0,0,0,0.22)]`}>
                          {avatarInitial}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <p className="text-[0.94rem] font-semibold leading-none text-white">{displayName}</p>
                          {isMe ? (
                            <span className="rounded-lg border border-[rgba(21,209,255,0.3)] bg-[rgba(21,209,255,0.14)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-1)]">
                              Vous
                            </span>
                          ) : null}
                          {firstMessage.created_at ? (
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
                                className={`group/message relative ${messageIndex > 0 ? "pt-1" : ""}`}
                              >
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
                                  <div
                                    className="mt-2 flex flex-wrap items-center gap-1.5"
                                  >
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

                                {message.id && editingId !== message.id && canDelete ? (
                                  <div
                                    className={`absolute right-0 top-0 transition ${
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
                                      <div className="absolute right-0 top-10 z-50 min-w-[150px] rounded-[16px] border border-[var(--stroke)] bg-[rgba(12,19,29,0.98)] p-1.5 shadow-[0_20px_40px_rgba(2,8,18,0.42)]">
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

                        {reactionTargetMessage ? (
                          <div
                            className="relative mt-2 flex flex-wrap items-center gap-1.5"
                            ref={reactionPickerMessageId === reactionTargetMessage.id ? reactionPickerRef : null}
                          >
                            <button
                              type="button"
                              className={`inline-flex h-7.5 items-center gap-1 rounded-full border px-2.5 text-[10px] transition ${
                                reactionPickerMessageId === reactionTargetMessage.id
                                  ? "border-[rgba(21,209,255,0.32)] bg-[rgba(21,209,255,0.12)] text-white"
                                  : "border-[rgba(80,102,133,0.72)] bg-[rgba(37,49,69,0.92)] text-slate-300 hover:border-[rgba(120,146,184,0.9)] hover:text-white"
                              }`}
                              onClick={() =>
                                setReactionPickerMessageId((prev) =>
                                  prev === reactionTargetMessage.id ? null : reactionTargetMessage.id!,
                                )
                              }
                              title={t("add_reaction")}
                            >
                              <span className="text-sm leading-none">+</span>
                              <span>Reaction</span>
                            </button>

                            {reactionPickerMessageId === reactionTargetMessage.id ? (
                              <div className="absolute left-0 top-full z-50 mt-2">
                                <div className="w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[18px] border border-[rgba(80,102,133,0.78)] bg-[rgba(25,31,41,0.98)] shadow-[0_18px_40px_rgba(2,8,18,0.45)]">
                                  <EmojiPicker
                                    theme={Theme.DARK}
                                    onEmojiClick={(emojiData) => {
                                      onAddReaction(reactionTargetMessage.id!, emojiData.emoji);
                                      setReactionPickerMessageId(null);
                                    }}
                                    width={300}
                                    height={360}
                                    searchPlaceHolder={t("emoji_search")}
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full min-h-[320px] items-center justify-center">
            <p className="text-sm text-slate-500">
              {selectedChannel ? t("no_messages") : t("select_channel")}
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[rgba(36,52,75,0.72)] bg-[rgba(17,24,35,0.96)] px-4 py-3.5">
        {typingUsers.length > 0 ? (
          <div className="mb-4 text-sm text-slate-400">
            <span className="inline-flex items-center gap-2">
              <span className="flex gap-1">
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#7187ae] [animation-delay:0ms]" />
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#7187ae] [animation-delay:150ms]" />
                <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#7187ae] [animation-delay:300ms]" />
              </span>
              {typingUsers.length === 1
                ? t("typing_one", { username: typingUsers[0] })
                : t("typing_many", { usernames: typingUsers.join(", ") })}
            </span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="min-w-[220px] flex-1 rounded-[14px] border border-[rgba(53,74,104,0.9)] bg-[rgba(26,37,53,0.96)] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <input
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#60759d]"
                placeholder={inputPlaceholder}
                value={input}
                onChange={handleInputChange}
                disabled={!selectedChannel}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-[11px] border border-[rgba(66,88,121,0.82)] bg-[rgba(26,37,53,0.96)] px-3 py-2 text-[13px] font-medium text-slate-200 transition hover:border-[var(--stroke-strong)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    setShowEmojiPicker((prev) => !prev);
                    setShowGifPicker(false);
                  }}
                  disabled={!selectedChannel}
                  title="Emojis"
                >
                  <span>😊</span>
                  <span>Emoji</span>
                </button>
                {showEmojiPicker ? (
                  <div className="absolute bottom-14 right-0 z-50">
                    <EmojiPicker
                      theme={Theme.DARK}
                      onEmojiClick={(emojiData) => {
                        setInput((prev) => prev + emojiData.emoji);
                        setShowEmojiPicker(false);
                      }}
                      width={320}
                      height={400}
                      searchPlaceHolder={t("emoji_search")}
                    />
                  </div>
                ) : null}
              </div>

              <div className="relative" ref={gifPickerRef}>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-[11px] border border-[rgba(66,88,121,0.82)] bg-[rgba(26,37,53,0.96)] px-3 py-2 text-[13px] font-medium text-slate-200 transition hover:border-[var(--stroke-strong)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    setShowGifPicker((prev) => !prev);
                    setShowEmojiPicker(false);
                  }}
                  disabled={!selectedChannel}
                  title="GIF"
                >
                  <svg aria-hidden="true" className="h-3.5 w-3.5 text-[var(--brand-1)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="3" y="8" width="18" height="13" rx="2" />
                    <path d="M12 8v13" />
                    <path d="M19 8H5a2 2 0 0 1 0-4h14a2 2 0 0 1 0 4Z" />
                    <path d="M12 4H9.5a2.5 2.5 0 0 0 0 5H12V4Z" />
                    <path d="M12 4h2.5a2.5 2.5 0 0 1 0 5H12V4Z" />
                  </svg>
                  <span>GIF</span>
                </button>
                {showGifPicker ? (
                  <div className="absolute bottom-14 right-0 z-50 w-[340px] rounded-[24px] border border-[var(--stroke)] bg-[rgba(12,19,29,0.98)] p-3 shadow-[0_24px_48px_rgba(2,8,18,0.52)]">
                    <input
                      className="mb-3 w-full rounded-[16px] border border-[var(--stroke)] bg-[rgba(22,31,45,0.92)] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
                      placeholder="Rechercher un GIF..."
                      value={gifSearch}
                      onChange={(event) => setGifSearch(event.target.value)}
                    />
                    {gifError ? (
                      <p className="py-4 text-center text-xs text-rose-300">{gifError}</p>
                    ) : gifLoading ? (
                      <p className="py-4 text-center text-xs text-slate-400">Chargement des GIFs...</p>
                    ) : gifResults.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-400">Aucun GIF trouvé.</p>
                    ) : (
                      <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
                        {gifResults.map((gif) => (
                          <button
                            key={gif.id}
                            type="button"
                            className="overflow-hidden rounded-[16px] border border-[var(--stroke)] transition hover:border-[var(--brand-1)]"
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
            </div>

            <button
              type="submit"
              className="hidden items-center gap-2 rounded-[11px] bg-[linear-gradient(135deg,_rgba(0,158,203,0.95),_rgba(41,88,211,0.95))] px-4 py-2.5 text-[13px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 md:inline-flex"
              disabled={!selectedChannel || !input.trim()}
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M22 2 11 13" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m22 2-7 20-4-9-9-4Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("send")}
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-[11px] bg-[linear-gradient(135deg,_rgba(0,158,203,0.95),_rgba(41,88,211,0.95))] px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 md:hidden"
              disabled={!selectedChannel || !input.trim()}
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M22 2 11 13" strokeLinecap="round" strokeLinejoin="round" />
                <path d="m22 2-7 20-4-9-9-4Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("send")}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
