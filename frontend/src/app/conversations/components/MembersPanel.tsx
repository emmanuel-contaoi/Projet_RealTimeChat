"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Member } from "../types";

type MembersPanelProps = {
  members: Member[];
  onlineUserIds: Set<string>;
  currentUserId: string;
  currentUserRole: string;
  onUpdateRole: (userId: string, role: string) => void;
  onTransferOwnership: (userId: string) => void;
  onKickMember: (userId: string) => void;
  onBanMember: (userId: string, durationMinutes?: number) => void;
};

const ROLE_ORDER: Record<string, number> = {
  owner: 0,
  admin: 1,
  member: 2,
};

export default function MembersPanel({
  members,
  onlineUserIds,
  currentUserId,
  currentUserRole,
  onUpdateRole,
  onTransferOwnership,
  onKickMember,
  onBanMember,
}: MembersPanelProps) {
  const t = useTranslations("members");
  const tc = useTranslations("common");

  const [search, setSearch] = useState("");
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [banDuration, setBanDuration] = useState("");
  const [actionMenuTarget, setActionMenuTarget] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!actionMenuTarget) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!actionMenuRef.current?.contains(event.target as Node)) {
        setActionMenuTarget(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [actionMenuTarget]);

  const sorted = [...members].sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3)
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filteredMembers = normalizedSearch
    ? sorted.filter((member) => member.username.toLowerCase().includes(normalizedSearch))
    : sorted;

  const onlineCount = filteredMembers.filter((m) => onlineUserIds.has(m.user_id)).length;
  const isOwner = currentUserRole === "owner";

  const ROLE_LABELS: Record<string, string> = {
    owner: t("role_owner"),
    admin: t("role_admin"),
    member: t("role_member"),
  };
  const onlineMembers = filteredMembers.filter((member) => onlineUserIds.has(member.user_id));
  const offlineMembers = filteredMembers.filter((member) => !onlineUserIds.has(member.user_id));

  const renderMember = (member: Member) => {
            const isOnline = onlineUserIds.has(member.user_id);
            const isMe = member.user_id === currentUserId;
            const canChangeRole = isOwner && !isMe && member.role !== "owner";
            const canTransfer = isOwner && !isMe && member.role !== "owner";
            const isAdmin = currentUserRole === "admin";
            const canKick =
              !isMe &&
              member.role !== "owner" &&
              (isOwner || (isAdmin && member.role === "member"));
            const canBan = canKick;
            const avatarInitial = member.username.charAt(0).toUpperCase();
            const hasActions = canChangeRole || canTransfer || canKick || canBan;

            return (
              <div
                key={member.user_id}
                className="relative flex flex-col gap-2 rounded-[18px] border border-[rgba(36,52,75,0.9)] bg-[rgba(18,27,39,0.94)] px-3.5 py-3"
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,_var(--brand-2),_var(--brand-1))] text-sm font-semibold text-white">
                      {avatarInitial}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[var(--sidebar)] ${
                        isOnline ? "bg-[var(--success)]" : "bg-slate-600"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-base font-semibold text-white">
                        {member.username}
                      </p>
                      {isMe ? (
                        <span className="rounded-full border border-[rgba(21,209,255,0.3)] bg-[rgba(21,209,255,0.08)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-1)]">
                          Vous
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {member.username}{isMe ? ` ${t("you")}` : ""}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2.5">
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] ${
                          member.role === "owner"
                            ? "border-[rgba(248,194,77,0.3)] bg-[rgba(248,194,77,0.1)] text-yellow-400"
                            : member.role === "admin"
                              ? "border-[rgba(21,209,255,0.28)] bg-[rgba(21,209,255,0.08)] text-[var(--brand-1)]"
                              : "border-[var(--stroke)] bg-[rgba(255,255,255,0.03)] text-slate-400"
                        }`}
                      >
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                      {hasActions ? (
                        <div
                          className="relative shrink-0"
                          ref={actionMenuTarget === member.user_id ? actionMenuRef : null}
                        >
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] border border-[rgba(21,209,255,0.22)] bg-[rgba(36,54,80,0.58)] text-slate-200 transition hover:border-[rgba(21,209,255,0.35)] hover:text-white"
                            onClick={() =>
                              setActionMenuTarget((current) =>
                                current === member.user_id ? null : member.user_id
                              )
                            }
                            aria-expanded={actionMenuTarget === member.user_id}
                            aria-haspopup="menu"
                            aria-label={t("actions")}
                            title={t("actions")}
                          >
                            <svg
                              aria-hidden="true"
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle cx="12" cy="5" r="1.7" fill="currentColor" />
                              <circle cx="12" cy="12" r="1.7" fill="currentColor" />
                              <circle cx="12" cy="19" r="1.7" fill="currentColor" />
                            </svg>
                          </button>
                          {actionMenuTarget === member.user_id ? (
                            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-40 rounded-2xl border border-[rgba(40,59,86,0.95)] bg-[rgba(10,16,24,0.98)] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.38)] backdrop-blur-xl">
                              {canChangeRole ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] text-slate-200 transition hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
                                  onClick={() => {
                                    onUpdateRole(
                                      member.user_id,
                                      member.role === "admin" ? "member" : "admin"
                                    );
                                    setActionMenuTarget(null);
                                  }}
                                  title={
                                    member.role === "admin"
                                      ? t("demote_title")
                                      : t("promote_title")
                                  }
                                >
                                  {member.role === "admin" ? t("demote") : t("promote")}
                                </button>
                              ) : null}
                              {canTransfer ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] text-slate-200 transition hover:bg-[rgba(248,194,77,0.08)] hover:text-yellow-300"
                                  onClick={() => {
                                    onTransferOwnership(member.user_id);
                                    setActionMenuTarget(null);
                                  }}
                                  title={t("transfer_title")}
                                >
                                  {t("transfer")}
                                </button>
                              ) : null}
                              {canKick ? (
                                <button
                                  type="button"
                                  className="flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] text-slate-200 transition hover:bg-[rgba(248,113,113,0.08)] hover:text-red-300"
                                  onClick={() => {
                                    onKickMember(member.user_id);
                                    setActionMenuTarget(null);
                                  }}
                                  title={t("kick_title")}
                                >
                                  {t("kick")}
                                </button>
                              ) : null}
                              {canBan ? (
                                <>
                                  <button
                                    type="button"
                                    className="flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] text-slate-200 transition hover:bg-[rgba(251,146,60,0.08)] hover:text-orange-300"
                                    onClick={() => {
                                      onBanMember(member.user_id);
                                      setActionMenuTarget(null);
                                    }}
                                    title={t("ban_title")}
                                  >
                                    {t("ban")}
                                  </button>
                                  <button
                                    type="button"
                                    className="flex w-full items-center rounded-xl px-3 py-2 text-left text-[11px] text-slate-200 transition hover:bg-[rgba(253,186,116,0.08)] hover:text-orange-200"
                                    onClick={() => {
                                      setBanTarget(member.user_id);
                                      setBanDuration("");
                                      setActionMenuTarget(null);
                                    }}
                                    title={t("ban_temp_title")}
                                  >
                                    {t("ban_temp")}
                                  </button>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {banTarget === member.user_id && (
                  <form
                    className="flex items-center gap-2 mt-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const mins = parseInt(banDuration, 10);
                      if (!mins || mins <= 0) return;
                      onBanMember(member.user_id, mins);
                      setBanTarget(null);
                      setBanDuration("");
                    }}
                  >
                    <input
                      type="number"
                      min={1}
                      placeholder={t("ban_duration_placeholder")}
                      value={banDuration}
                      onChange={(e) => setBanDuration(e.target.value)}
                      className="w-28 rounded-xl border border-[var(--stroke)] bg-[rgba(10,16,24,0.92)] px-2 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="text-[10px] text-orange-400 transition hover:text-orange-300"
                    >
                      {tc("confirm")}
                    </button>
                    <button
                      type="button"
                      className="text-[10px] text-slate-500 transition hover:text-white"
                      onClick={() => setBanTarget(null)}
                    >
                      {tc("cancel")}
                    </button>
                  </form>
                )}
              </div>
            );
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[rgba(11,18,27,0.92)] p-3">
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <svg aria-hidden="true" className="h-4.5 w-4.5 text-[var(--brand-1)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9.5" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-xl font-semibold text-white">{t("title")}</p>
        </div>
        <span className="rounded-full border border-[rgba(21,209,255,0.25)] bg-[rgba(21,209,255,0.08)] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-1)]">
          {t("online_count", { count: onlineCount })}
        </span>
      </div>

      <div className="mt-4 rounded-[18px] border border-[var(--stroke)] bg-[rgba(19,28,41,0.92)] px-3.5 py-2.5">
        <div className="flex items-center gap-3">
          <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
            placeholder="Rechercher..."
          />
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto">
        <div>
          <div className="mb-2.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            <span>En ligne</span>
            <span>{onlineMembers.length}</span>
          </div>
          <div className="space-y-2.5">
            {onlineMembers.length ? onlineMembers.map(renderMember) : (
              <p className="rounded-[20px] border border-[var(--stroke)] bg-[rgba(19,28,41,0.92)] px-4 py-4 text-xs text-slate-400">
                {t("empty")}
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            <span>Hors ligne</span>
            <span>{offlineMembers.length}</span>
          </div>
          <div className="space-y-2.5">
            {offlineMembers.length ? offlineMembers.map(renderMember) : (
              <p className="rounded-[20px] border border-[var(--stroke)] bg-[rgba(19,28,41,0.92)] px-4 py-4 text-xs text-slate-400">
                {t("empty")}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
