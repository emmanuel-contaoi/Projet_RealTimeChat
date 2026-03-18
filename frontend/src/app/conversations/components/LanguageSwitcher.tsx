"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

// Bouton FR / EN
// Au clic : écrit le cookie "locale" puis recharge la page
// request.ts lira ce cookie et chargera le bon fichier JSON
export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  const toggle = () => {
    const next = locale === "fr" ? "en" : "fr";
    document.cookie = `locale=${next}; path=/; max-age=31536000`; // 1 an
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--surface-strong)]"
      title="Changer de langue"
    >
      {locale === "fr" ? "EN" : "FR"}
    </button>
  );
}
