import type { Member } from "../types";

type MembersPanelProps = {
  members: Member[];
  onlineUserIds: Set<string>;
  currentUserId: string;
  currentUserRole: string;
  onUpdateRole: (userId: string, role: string) => void;
  onTransferOwnership: (userId: string) => void;
  onKickMember: (userId: string) => void;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Membre",
};

const ROLE_ORDER: Record<string, number> = {
  owner: 0,
  admin: 1,
  member: 2,
};

// Affiche la liste des membres du serveur avec leurs roles
export default function MembersPanel({
  members,
  onlineUserIds,
  currentUserId,
  currentUserRole,
  onUpdateRole,
  onTransferOwnership,
  onKickMember,
}: MembersPanelProps) {
  // On trie les membres par role (owner en premier, puis admin, puis member)
  const sorted = [...members].sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3)
  );

  const onlineCount = members.filter((m) => onlineUserIds.has(m.user_id)).length;
  const isOwner = currentUserRole === "owner";

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
      <div className="flex shrink-0 items-center justify-between">
        <p className="text-sm font-semibold text-white">Membres</p>
        <span className="text-[10px] text-slate-400">
          {onlineCount} en ligne
        </span>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {sorted.length ? (
          sorted.map((member) => {
            const isOnline = onlineUserIds.has(member.user_id);
            const isMe = member.user_id === currentUserId;
            const canChangeRole = isOwner && !isMe && member.role !== "owner";
            const canTransfer = isOwner && !isMe && member.role !== "owner";
            // Owner et admin peuvent kick, mais pas le owner cible, pas soi-même
            // Un admin ne peut pas kick un autre admin (géré aussi côté backend)
            const isAdmin = currentUserRole === "admin";
            const canKick =
              !isMe &&
              member.role !== "owner" &&
              (isOwner || (isAdmin && member.role === "member"));

            return (
              <div
                key={member.user_id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-2"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    isOnline ? "bg-green-400" : "bg-slate-600"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm text-white">
                    {member.username}{isMe ? " (vous)" : ""}
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
                            ? "Retrograder en membre"
                            : "Promouvoir admin"
                        }
                      >
                        {member.role === "admin" ? "Retrograder" : "Promouvoir"}
                      </button>
                    )}
                    {canTransfer && (
                      <button
                        type="button"
                        className="text-[10px] text-slate-500 hover:text-yellow-400 transition"
                        onClick={() => onTransferOwnership(member.user_id)}
                        title="Transferer la propriete"
                      >
                        Transferer
                      </button>
                    )}
                    {canKick && (
                      <button
                        type="button"
                        className="text-[10px] text-slate-500 hover:text-red-400 transition"
                        onClick={() => onKickMember(member.user_id)}
                        title="Expulser ce membre"
                      >
                        Kick
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-slate-400">Aucun membre.</p>
        )}
      </div>
    </section>
  );
}
