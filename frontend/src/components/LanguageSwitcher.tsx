"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

// Bouton FR / EN
// Au clic : écrit le cookie "locale" puis recharge la page
// request.ts lira ce cookie et chargera le bon fichier JSON
type LanguageSwitcherProps = {
  compact?: boolean;
};

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();

  const LOCALES = ["fr", "en", "es"] as const;
  const LABELS: Record<string, string> = { fr: "FR", en: "EN", es: "ES" };

  const toggle = () => {
    const currentIndex = LOCALES.indexOf(locale as typeof LOCALES[number]);
    const next = LOCALES[(currentIndex + 1) % LOCALES.length];
    document.cookie = `locale=${next}; path=/; max-age=31536000`; // 1 an
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`rounded-full border border-[var(--stroke)] bg-[var(--surface)] font-semibold text-white transition hover:bg-[var(--surface-strong)] ${
        compact
          ? "inline-flex h-10 shrink-0 items-center justify-center rounded-[14px] px-3 text-[13px] whitespace-nowrap"
          : "px-3 py-1.5 text-xs"
      }`}
      title="Changer de langue"
    >
      {LABELS[locale] ?? locale.toUpperCase()}
    </button>
  );
}
