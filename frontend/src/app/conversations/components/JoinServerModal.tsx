import type { FormEvent } from "react";

type JoinServerModalProps = {
  isOpen: boolean;
  inviteCode: string;
  error: string;
  loading: boolean;
  onClose: () => void;
  onInviteCodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function JoinServerModal({
  isOpen,
  inviteCode,
  error,
  loading,
  onClose,
  onInviteCodeChange,
  onSubmit,
}: JoinServerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-[rgba(5,12,25,0.75)] backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[0_20px_40px_rgba(6,10,20,0.6)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Serveur
            </p>
            <h2 className="font-display text-2xl text-white">
              Rejoindre un serveur
            </h2>
          </div>
          <button
            className="rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-1 text-xs text-slate-200 transition hover:bg-[var(--surface)]"
            onClick={onClose}
            type="button"
          >
            Fermer
          </button>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm text-slate-200">
            Code d&apos;invitation
            <input
              className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
              value={inviteCode}
              onChange={(event) => onInviteCodeChange(event.target.value)}
              placeholder="Ex: a1b2c3d4"
              required
            />
          </label>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="mt-2 flex items-center justify-between gap-3">
            <button
              className="rounded-full border border-[var(--stroke)] px-5 py-2.5 text-sm text-slate-200 transition hover:bg-[var(--surface-strong)]"
              onClick={onClose}
              type="button"
            >
              Annuler
            </button>
            <button
              className="rounded-full bg-[var(--brand-1)] px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={!inviteCode.trim() || loading}
            >
              {loading ? "Connexion..." : "Rejoindre"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
