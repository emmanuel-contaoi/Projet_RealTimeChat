"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { Channel } from "../types";

type ChannelsPanelProps = {
  channels: Channel[];
  selectedChannel: string;
  canManageChannels: boolean;
  unreadChannels: Set<string>;
  onSelectChannel: (channelId: string) => void;
  onDeleteChannel: (channelId: string) => void;
  onUpdateChannel: (channelId: string, newName: string) => void;
  onCreateChannel: () => void;
};

export default function ChannelsPanel({
  channels,
  selectedChannel,
  canManageChannels,
  unreadChannels,
  onSelectChannel,
  onDeleteChannel,
  onUpdateChannel,
  onCreateChannel,
}: ChannelsPanelProps) {
  const t = useTranslations("channels");

  const handleDelete = (e: React.MouseEvent, channelId: string) => {
    e.stopPropagation();
    onDeleteChannel(channelId);
  };

  const handleRename = (e: React.MouseEvent, channelId: string, currentName: string) => {
    e.stopPropagation();
    const newName = prompt(t("rename_prompt"), currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      onUpdateChannel(channelId, newName.trim().slice(0, 20));
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex shrink-0 items-center justify-between">
        <p className="text-sm font-semibold text-white">{t("title")}</p>
        {canManageChannels && (
          <button
            type="button"
            className="rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-1 text-[11px] text-[var(--brand-1)] transition hover:bg-[var(--surface)]"
            onClick={onCreateChannel}
          >
            {t("add")}
          </button>
        )}
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {channels.length ? (
          channels.map((channel) => {
            const isActive = selectedChannel === channel.id;
            // On vérifie si ce channel a des messages non lus
            const isUnread = unreadChannels.has(channel.id) && !isActive;

            return (
              <div
                key={channel.id}
                className={`group relative flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition cursor-pointer ${
                  isActive
                    ? "border-[var(--brand-1)] bg-[rgba(0,212,255,0.10)] text-white font-semibold"
                    : isUnread
                    ? "border-[rgba(255,255,255,0.2)] bg-[var(--surface-strong)] text-white font-bold"
                    : "border-[var(--stroke)] bg-[var(--surface-strong)] text-slate-400 font-medium hover:border-[rgba(0,212,255,0.3)] hover:bg-[var(--surface)] hover:text-white"
                }`}
                onClick={() => onSelectChannel(channel.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") onSelectChannel(channel.id); }}
              >
                {/* PASTILLE DE NOTIFICATION (Point rouge) */}
                {isUnread && (
                  <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" />
                )}

                <span className="truncate flex items-center gap-2">
                  <span className={isActive ? "text-[var(--brand-1)]" : "text-slate-500"}>#</span>
                  {channel.name}
                </span>

                {canManageChannels && (
                  <span className="ml-2 flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      className="rounded-full p-1 text-slate-500 transition hover:text-[var(--brand-1)]"
                      onClick={(e) => handleRename(e, channel.id, channel.name)}
                      title={t("rename")}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="rounded-full p-1 text-slate-500 transition hover:text-red-400"
                      onClick={(e) => handleDelete(e, channel.id)}
                      title={t("delete")}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
            {t("empty")}
          </p>
        )}
      </div>
    </section>
  );
}