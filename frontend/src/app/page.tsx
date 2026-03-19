"use client";
// Page d'accueil avec presentation du projet et les features
import Image from "next/image";

import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function Home() {
  const t = useTranslations("home");

  const features = [
    {
      key: "realtime",
      title: t("feature_realtime_title"),
      description: t("feature_realtime_desc"),
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      key: "channels",
      title: t("feature_channels_title"),
      description: t("feature_channels_desc"),
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
          <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
        </svg>
      ),
    },
    {
      key: "roles",
      title: t("feature_roles_title"),
      description: t("feature_roles_desc"),
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.45),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />

      <header className="relative z-10 mx-auto flex w-full max-w-none items-center justify-between px-8 py-6 md:px-12">
        <Image src="/logo.svg" alt="Logo Nexus" width={48} height={48} className="h-12 w-auto" />
        <div className="flex items-center gap-4 text-base font-semibold">
          <LanguageSwitcher />
          <a className="rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-6 py-3 text-slate-200 transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]" href="/login">
            {t("login")}
          </a>
          <a className="rounded-full bg-[var(--brand-1)] px-6 py-3 text-white shadow-[0_10px_24px_rgba(88,101,242,0.45)] transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)] md:inline-flex" href="/register">
            {t("register")}
          </a>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-16 px-6 py-10">
        <section className="flex flex-col gap-6 text-center">
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            <h1 className="font-display text-4xl leading-tight text-white md:text-5xl">
              {t("tagline")}
            </h1>
            <p className="text-base leading-7 text-slate-300">{t("description")}</p>
          </div>
        </section>

        <section id="features" className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.key}
              className="group rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[0_14px_30px_rgba(6,10,20,0.5)] transition hover:-translate-y-1 hover:border-[rgba(0,212,255,0.3)] hover:shadow-[0_20px_40px_rgba(0,212,255,0.1)]"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(0,212,255,0.1)] text-[var(--brand-1)]">
                {feature.icon}
              </div>
              <p className="font-semibold text-white">{feature.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.description}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 px-8 py-6 md:px-12">
        <p className="text-center text-xs text-slate-600">{t("title")}</p>
      </footer>
    </div>
  );
}
