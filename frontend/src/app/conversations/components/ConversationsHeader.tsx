"use client";

import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type ConversationsHeaderProps = {
  isMenuOpen: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  onToggleMenu: () => void;
  onEditProfile: () => void;
  onSwitchAccount: () => void;
  onLogout: () => void;
};

export default function ConversationsHeader({
  isMenuOpen,
  menuRef,
  onToggleMenu,
  onEditProfile,
  onSwitchAccount,
  onLogout,
}: ConversationsHeaderProps) {
  const t = useTranslations("header");

  return (
    <header className="relative z-30 mx-auto grid w-full max-w-none shrink-0 grid-cols-3 items-center px-8 py-4 md:px-12">
      {/* Left: Profil button */}
      <div className="flex items-center">
        <div className="relative z-20" ref={menuRef}>
          <button
            className="flex items-center gap-3 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
            onClick={onToggleMenu}
            type="button"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[var(--brand-1)]">
              <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 21a8 8 0 0 0-16 0" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            {t("profile")}
          </button>

          {isMenuOpen ? (
            <div className="absolute left-0 z-50 mt-3 w-56 rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-2 text-sm shadow-[0_14px_30px_rgba(6,10,20,0.55)]">
              <button
                className="w-full rounded-xl px-3 py-2 text-left text-slate-200 transition hover:bg-[var(--surface-strong)]"
                onClick={onEditProfile}
                type="button"
              >
                {t("edit_account")}
              </button>
              <button
                className="w-full rounded-xl px-3 py-2 text-left text-slate-200 transition hover:bg-[var(--surface-strong)]"
                onClick={onSwitchAccount}
                type="button"
              >
                {t("switch_account")}
              </button>
              <button
                className="w-full rounded-xl px-3 py-2 text-left text-rose-200 transition hover:bg-[rgba(255,77,255,0.12)]"
                onClick={onLogout}
                type="button"
              >
                {t("logout")}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Center: Logo */}
      <div className="flex items-center justify-center">
        <img src="/logo.svg" alt={t("app_name")} className="h-12 w-auto" />
      </div>

      {/* Right: language switcher */}
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>
    </header>
  );
}
