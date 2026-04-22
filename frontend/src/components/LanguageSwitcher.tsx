"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type LanguageSwitcherProps = {
  compact?: boolean;
};

const LOCALES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

function setLocaleCookie(code: string) {
  document.cookie = `locale=${code}; path=/; max-age=31536000`;
}

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  const select = (code: string) => {
    setLocaleCookie(code);
    setOpen(false);
    router.refresh();
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 border border-[var(--stroke)] bg-[var(--surface)] font-semibold text-white transition hover:bg-[var(--surface-strong)] ${
          compact
            ? "h-10 shrink-0 rounded-[14px] px-3 text-[13px] whitespace-nowrap"
            : "rounded-full px-3 py-1.5 text-xs"
        }`}
        title="Changer de langue"
      >
        <span>{current.code.toUpperCase()}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[9999] mt-1.5 w-[160px] rounded-[14px] border border-[var(--stroke)] bg-[rgba(12,19,29,0.98)] py-1 shadow-[0_16px_40px_rgba(2,8,18,0.45)]">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => select(l.code)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-[13px] transition hover:bg-[rgba(255,255,255,0.06)] ${
                l.code === locale
                  ? "font-semibold text-[var(--brand-1)]"
                  : "text-slate-200"
              }`}
            >
              <span className="text-[11px] font-bold text-slate-400">{l.code.toUpperCase()}</span>
              <span>{l.label}</span>
              {l.code === locale && (
                <svg className="ml-auto h-3.5 w-3.5 text-[var(--brand-1)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
