import type { FormEvent } from "react";

type CreateServerModalProps = {
  isOpen: boolean;
  newServerName: string;
  newServerMembers: string;
  channelList: string[];
  onClose: () => void;
  onOpenAddChannel: () => void;
  onServerNameChange: (value: string) => void;
  onServerMembersChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function CreateServerModal({
  isOpen,
  newServerName,
  newServerMembers,
  channelList,
  onClose,
  onOpenAddChannel,
  onServerNameChange,
  onServerMembersChange,
  onSubmit,
}: CreateServerModalProps) {
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
              Créer un serveur
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
            Nom du serveur
            <input
              className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
              value={newServerName}
              onChange={(event) => onServerNameChange(event.target.value)}
              placeholder="Ex: Studio"
              required
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-200">
            Membres (optionnel)
            <input
              className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
              value={newServerMembers}
              onChange={(event) => onServerMembersChange(event.target.value)}
              placeholder="Ex: 8 membres"
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-200">
            Channels
            <button
              className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-left text-sm font-semibold text-[var(--brand-1)] transition hover:-translate-y-0.5 hover:bg-[var(--surface)]"
              onClick={onOpenAddChannel}
              type="button"
            >
              + Ajouter des channels
            </button>
            {channelList.length ? (
              <div className="flex flex-wrap gap-2">
                {channelList.map((channel) => (
                  <span
                    key={channel}
                    className="rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-1 text-xs text-slate-200"
                  >
                    #{channel}
                  </span>
                ))}
              </div>
            ) : null}
          </label>
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
              disabled={!newServerName.trim()}
            >
              Créer et ouvrir
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
