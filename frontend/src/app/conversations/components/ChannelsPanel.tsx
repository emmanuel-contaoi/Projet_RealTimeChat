"use client";

import React, { useEffect, useRef, useState } from "react";
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
  const [openMenuChannelId, setOpenMenuChannelId] = useState<string | null>(null);
  const openMenuRef = useRef<HTMLDivElement | null>(null);

  const handleDelete = (e: React.MouseEvent, channelId: string) => {
    e.stopPropagation();
    setOpenMenuChannelId(null);
    onDeleteChannel(channelId);
  };

  const handleRename = (e: React.MouseEvent, channelId: string, currentName: string) => {
    e.stopPropagation();
    setOpenMenuChannelId(null);
    const newName = prompt(t("rename_prompt"), currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      onUpdateChannel(channelId, newName.trim().slice(0, 20));
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!openMenuRef.current) return;
      if (!openMenuRef.current.contains(event.target as Node)) {
        setOpenMenuChannelId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <section className="flex h-full min-h-0 flex-col border-b border-[var(--stroke)] bg-[rgba(11,18,27,0.92)] p-3 lg:border-b-0 lg:border-r">
      <div className="flex shrink-0 items-center justify-between border-b border-[rgba(74,97,127,0.22)] pb-3">
        <div>
          <p className="text-xl font-semibold text-white">Serveur</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {t("title")}
          </p>
        </div>
        {canManageChannels && (
          <button
            type="button"
            className="rounded-[12px] border border-[var(--stroke)] bg-[rgba(20,31,45,0.92)] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-1)] transition hover:border-[rgba(21,209,255,0.34)] hover:bg-[rgba(24,38,55,0.98)]"
            onClick={onCreateChannel}
          >
            {t("add")}
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        <span>Salons textuels</span>
        <span>{channels.length}</span>
      </div>

      <div className="mt-2.5 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {channels.length ? (
          channels.map((channel) => {
            const isActive = selectedChannel === channel.id;
            const isUnread = unreadChannels.has(channel.id) && !isActive;

            return (
              <div
                key={channel.id}
                className={`group relative flex min-h-[52px] w-full items-center justify-between rounded-[16px] border px-3 py-2.5 text-[13px] leading-none transition cursor-pointer ${
                  isActive
                    ? "border-[rgba(21,209,255,0.5)] bg-[rgba(25,63,107,0.58)] text-white font-medium"
                    : isUnread
                    ? "border-[rgba(255,255,255,0.2)] bg-[rgba(19,28,41,0.94)] text-white font-medium"
                    : "border-transparent bg-transparent text-slate-400 font-medium hover:border-[rgba(21,209,255,0.14)] hover:bg-[rgba(20,31,45,0.7)] hover:text-white"
                }`}
                onClick={() => {
                  setOpenMenuChannelId(null);
                  onSelectChannel(channel.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setOpenMenuChannelId(null);
                    onSelectChannel(channel.id);
                  }
                }}
              >
                {isUnread && (
                  <span className="absolute right-3 top-1/2 flex h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-semibold text-white">
                    1
                  </span>
                )}

                {isActive ? (
                  <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[var(--brand-1)]" />
                ) : null}

                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className={`w-5 shrink-0 text-center text-[1.65rem] leading-none ${isActive ? "text-[var(--brand-1)]" : "text-slate-500"}`}>#</span>
                  <span className="truncate">{channel.name}</span>
                </span>

                {canManageChannels && (
                  <div
                    className={`relative ml-2 shrink-0 transition ${openMenuChannelId === channel.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                    ref={openMenuChannelId === channel.id ? openMenuRef : null}
                  >
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[var(--stroke)] bg-[rgba(35,49,71,0.96)] text-slate-300 transition hover:border-[rgba(21,209,255,0.28)] hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuChannelId((prev) => (prev === channel.id ? null : channel.id));
                      }}
                      title="Options"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="12" cy="5" r="1.8" />
                        <circle cx="12" cy="12" r="1.8" />
                        <circle cx="12" cy="19" r="1.8" />
                      </svg>
                    </button>

                    {openMenuChannelId === channel.id ? (
                      <div className="absolute right-0 top-11 z-50 min-w-[152px] rounded-[16px] border border-[var(--stroke)] bg-[rgba(12,19,29,0.98)] p-1.5 shadow-[0_20px_40px_rgba(2,8,18,0.42)]">
                        <button
                          type="button"
                          className="flex w-full items-center rounded-[12px] px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-[rgba(21,209,255,0.1)] hover:text-white"
                          onClick={(e) => handleRename(e, channel.id, channel.name)}
                        >
                          {t("rename")}
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center rounded-[12px] px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-[rgba(255,84,109,0.12)] hover:text-white"
                          onClick={(e) => handleDelete(e, channel.id)}
                        >
                          {t("delete")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="rounded-[20px] border border-[var(--stroke)] bg-[rgba(19,28,41,0.92)] px-4 py-4 text-xs text-slate-400">
            {t("empty")}
          </p>
        )}
      </div>


    </section>
  );
}
