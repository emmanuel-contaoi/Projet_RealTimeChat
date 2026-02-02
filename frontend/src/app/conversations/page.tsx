"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const servers = [
  {
    name: "Gaming",
    members: "120 membres",
    status: "En ligne",
  },
  {
    name: "Travail",
    members: "45 membres",
    status: "Actif",
  },
];

const conversations = [
  {
    title: "Chat gaming",
    preview: "Salut",
    time: "Il y a 2 min",
    badge: "1",
  },
  {
    title: "Bureau",
    preview: "Bonjour",
    time: "Il y a 12 min",
    badge: null,
  },
  {
    title: "Amis",
    preview: "Tu veux jouer ce soir ?",
    time: "Il y a 1 h",
    badge: "2",
  },
];

const messages = [
  {
    sender: "Alex",
    text: "Salut !",
    time: "18:42",
    me: false,
  },
  {
    sender: "Moi",
    text: "Salut, tu veux jouer ?",
    time: "18:43",
    me: true,
  },
  {
    sender: "Alex",
    text: "Oui, une petite partie ?",
    time: "18:44",
    me: false,
  },
];

export default function ConversationsPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const isAuthed = localStorage.getItem("nexus-auth") === "true";
    if (!isAuthed) {
      router.replace("/connexion");
      return;
    }
    setIsReady(true);
  }, [router]);

  if (!isReady) {
    return (
      <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.35),_transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-none items-center justify-center px-6">
          <p className="text-sm text-slate-300">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.35),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />

      <header className="relative z-10 mx-auto flex w-full max-w-none flex-wrap items-center justify-between gap-4 px-8 py-6 md:px-12">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Logo Nexus" className="h-10 w-auto" />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Conversations
            </p>
            <h1 className="font-display text-2xl text-white">
              Serveurs et discussions
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4 text-base font-semibold">
          <a
            className="rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-6 py-3 text-slate-200 transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
            href="/"
          >
            Retour
          </a>
          <button className="rounded-full bg-[var(--brand-1)] px-6 py-3 text-white shadow-[0_10px_24px_rgba(0,212,255,0.35)] transition hover:-translate-y-0.5">
            Nouvelle discussion
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-none flex-col gap-6 px-8 pb-16 md:px-12">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Serveurs</p>
              <span className="text-xs text-slate-400">
                {servers.length} actifs
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {servers.map((server) => (
                <div
                  key={server.name}
                  className="flex flex-col gap-2 rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">
                      {server.name}
                    </p>
                    <span className="rounded-full bg-[rgba(0,212,255,0.2)] px-2 py-1 text-[10px] font-semibold text-[var(--brand-1)]">
                      {server.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{server.members}</p>
                </div>
              ))}
            </div>
          </aside>

          <section className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  Conversations
                </p>
                <p className="text-xs text-slate-400">
                  Toutes tes discussions en un coup d'oeil
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
              <div className="grid gap-3">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.title}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {conversation.title}
                      </p>
                      <p className="text-xs text-slate-300">
                        {conversation.preview}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{conversation.time}</span>
                      {conversation.badge ? (
                        <span className="rounded-full bg-[var(--brand-2)] px-2 py-1 text-[10px] font-semibold text-white">
                          {conversation.badge}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex h-full flex-col rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)]">
                <div className="flex items-center justify-between border-b border-[var(--stroke)] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Chat gaming
                    </p>
                    <p className="text-xs text-slate-400">
                      En ligne il y a 2 min
                    </p>
                  </div>
                  <span className="rounded-full bg-[rgba(0,212,255,0.2)] px-2 py-1 text-[10px] font-semibold text-[var(--brand-1)]">
                    Actif
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-3 px-4 py-4">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.sender}-${index}`}
                      className={`flex ${
                        message.me ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                          message.me
                            ? "bg-[var(--brand-1)] text-slate-900"
                            : "bg-[var(--surface)] text-slate-200"
                        }`}
                      >
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                          {message.sender}
                        </p>
                        <p>{message.text}</p>
                        <p className="mt-1 text-[10px] text-slate-400">
                          {message.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 border-t border-[var(--stroke)] px-4 py-3">
                  <div className="flex-1 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-3 text-xs text-slate-400">
                    Ecris un message...
                  </div>
                  <button className="rounded-full bg-[var(--brand-1)] px-5 py-2.5 text-sm font-semibold text-slate-900">
                    Envoyer
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
