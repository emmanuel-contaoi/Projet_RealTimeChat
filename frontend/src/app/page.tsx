export default function Home() {
  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.45),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-end px-6 py-6">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <a
            className="hidden rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-slate-200 transition hover:bg-[var(--surface-strong)] md:inline-flex"
            href="/connexion"
          >
            Connexion
          </a>
          <a
            className="rounded-full bg-[var(--brand-1)] px-4 py-2 text-white shadow-[0_10px_24px_rgba(88,101,242,0.45)] transition hover:-translate-y-0.5"
            href="/inscription"
          >
            Inscription
          </a>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 pb-20 pt-10">
        <section className="flex flex-col gap-6 text-center">
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            <div className="w-fit rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
              Gaming Chat Platform
            </div>
            <h1 className="font-display text-4xl leading-tight text-white md:text-5xl">
              Ton hub de jeu, simple et instantané.
            </h1>
            <p className="text-base leading-7 text-slate-300">
              Crée des serveurs, organise en canaux, gère les rôles. Tout est
              synchronisé en temps réel et persisté.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                className="rounded-full bg-[var(--brand-1)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(71,82,196,0.3)] transition hover:-translate-y-0.5"
                href="#features"
              >
                Commencer
              </a>
            </div>
          </div>
        </section>

        <section id="features" className="grid gap-4 md:grid-cols-3">
          {[
            ["Temps réel", "Messages, présence, typing."],
            ["Canaux", "Organisation claire par sujets."],
            ["Rôles", "Owner · Admin · Member."],
          ].map(([title, description]) => (
            <div
              key={title}
              className="rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[0_14px_30px_rgba(6,10,20,0.5)]"
            >
              <p className="font-semibold text-white">{title}</p>
              <p className="mt-2 text-sm text-slate-300">{description}</p>
            </div>
          ))}
        </section>

        
      </main>
    </div>
  );
}
