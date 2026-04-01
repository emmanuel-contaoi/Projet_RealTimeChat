"use client";

import { useTranslations } from "next-intl";
import type { FormEvent } from "react";

type AddChannelModalProps = {
  isOpen: boolean;
  newChannelName: string;
  onClose: () => void;
  onChannelNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function AddChannelModal({
  isOpen,
  newChannelName,
  onClose,
  onChannelNameChange,
  onSubmit,
}: AddChannelModalProps) {
  const t = useTranslations("add_channel_modal");
  const tc = useTranslations("common");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-[rgba(5,12,25,0.8)] backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative z-10 w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-[24px] border border-[var(--stroke)] bg-[var(--surface)] p-5 sm:p-6 shadow-[0_20px_40px_rgba(6,10,20,0.6)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-slate-400">Channel</p>
            <h3 className="mt-1 font-display text-lg sm:text-xl text-white">{t("title")}</h3>
          </div>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] text-slate-300 transition hover:bg-[var(--stroke)] hover:text-white sm:h-auto sm:w-auto sm:px-3 sm:py-1 sm:text-xs"
            onClick={onClose}
            type="button"
            title={tc("close")}
          >
            <span className="hidden sm:inline">{tc("close")}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="sm:hidden">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form className="mt-6 grid gap-5" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm font-medium text-slate-200">
            {t("name_label")}
            <input
              className="rounded-[16px] border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3.5 text-sm text-white outline-none transition focus:border-[var(--brand-1)] focus:bg-[rgba(26,37,53,0.9)]"
              value={newChannelName}
              onChange={(event) => onChannelNameChange(event.target.value)}
              placeholder={t("name_placeholder")}
              maxLength={20}
              required
            />
          </label>
          <div className="mt-4 flex items-center justify-between gap-3 pt-2 sm:mt-2 sm:pt-0">
            <button
              className="flex-1 rounded-[14px] border border-[var(--stroke)] px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-[var(--surface-strong)] hover:text-white sm:flex-none"
              onClick={onClose}
              type="button"
            >
              {tc("cancel")}
            </button>
            <button
              className="flex-1 rounded-[14px] bg-[var(--brand-1)] px-5 py-3 text-sm font-bold text-slate-900 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100 disabled:active:scale-100 sm:flex-none"
              type="submit"
              disabled={!newChannelName.trim()}
            >
              {t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}