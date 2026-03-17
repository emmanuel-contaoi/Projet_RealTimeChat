"use client";

import { useState } from "react";
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

  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [banDuration, setBanDuration] = useState("");

  const sorted = [...members].sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3)
  );

  const onlineCount = members.filter((m) => onlineUserIds.has(m.user_id)).length;
  const isOwner = currentUserRole === "owner";

  const ROLE_LABELS: Record<string, string> = {
    owner: t("role_owner"),
    admin: t("role_admin"),
    member: t("role_member"),
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex shrink-0 items-center justify-between">
        <p className="text-sm font-semibold text-white">{t("title")}</p>
        <span className="text-[10px] text-slate-400">
          {t("online_count", { count: onlineCount })}
        </span>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {sorted.length ? (
          sorted.map((member) => {
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

            return (
              <div
                key={member.user_id}
                className="flex flex-col gap-1 rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-2"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      isOnline ? "bg-green-400" : "bg-slate-600"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-white">
                      {member.username}{isMe ? ` ${t("you")}` : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={`text-[10px] uppercase tracking-[0.15em] ${
                          member.role === "owner"
                            ? "text-yellow-400"
                            : member.role === "admin"
                              ? "text-[var(--brand-1)]"
                              : "text-slate-400"
                        }`}
                      >
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                      {canChangeRole && (
                        <button
                          type="button"
                          className="text-[10px] text-slate-500 hover:text-white transition"
                          onClick={() =>
                            onUpdateRole(
                              member.user_id,
                              member.role === "admin" ? "member" : "admin"
                            )
                          }
                          title={
                            member.role === "admin"
                              ? t("demote_title")
                              : t("promote_title")
                          }
                        >
                          {member.role === "admin" ? t("demote") : t("promote")}
                        </button>
                      )}
                      {canTransfer && (
                        <button
                          type="button"
                          className="text-[10px] text-slate-500 hover:text-yellow-400 transition"
                          onClick={() => onTransferOwnership(member.user_id)}
                          title={t("transfer_title")}
                        >
                          {t("transfer")}
                        </button>
                      )}
                      {canKick && (
                        <button
                          type="button"
                          className="text-[10px] text-slate-500 hover:text-red-400 transition"
                          onClick={() => onKickMember(member.user_id)}
                          title={t("kick_title")}
                        >
                          {t("kick")}
                        </button>
                      )}
                      {canBan && (
                        <>
                          <button
                            type="button"
                            className="text-[10px] text-slate-500 hover:text-orange-400 transition"
                            onClick={() => onBanMember(member.user_id)}
                            title={t("ban_title")}
                          >
                            {t("ban")}
                          </button>
                          <button
                            type="button"
                            className="text-[10px] text-slate-500 hover:text-orange-300 transition"
                            onClick={() => {
                              setBanTarget(member.user_id);
                              setBanDuration("");
                            }}
                            title={t("ban_temp_title")}
                          >
                            {t("ban_temp")}
                          </button>
                        </>
                      )}
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
                      className="w-32 rounded-lg bg-[var(--surface)] border border-[var(--stroke)] px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="text-[10px] text-orange-400 hover:text-orange-300 transition"
                    >
                      {tc("confirm")}
                    </button>
                    <button
                      type="button"
                      className="text-[10px] text-slate-500 hover:text-white transition"
                      onClick={() => setBanTarget(null)}
                    >
                      {tc("cancel")}
                    </button>
                  </form>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-xs text-slate-400">{t("empty")}</p>
        )}
      </div>
    </section>
  );
}
