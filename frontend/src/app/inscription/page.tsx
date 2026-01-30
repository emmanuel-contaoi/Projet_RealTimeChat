export default function InscriptionPage() {
  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,77,255,0.35),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-none flex-col items-center justify-center gap-8 px-8 py-12 text-center md:px-12">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
            Création de compte
          </p>
          <h1 className="font-display text-3xl text-white md:text-4xl">
            Rejoins la communauté
          </h1>
          <p className="text-sm text-slate-300">
            Ajoute ton formulaire ici quand tu seras prêt.
          </p>
        </div>

        <form className="w-full max-w-2xl rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 text-left shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-slate-200">
              Nom
              <input
                className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                name="lastName"
                type="text"
                placeholder="Dupont"
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-200">
              Prénom
              <input
                className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                name="firstName"
                type="text"
                placeholder="Camille"
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-200">
              Mail
              <input
                className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                name="email"
                type="email"
                placeholder="camille@mail.com"
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-200">
              Numéro
              <input
                className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                name="phone"
                type="tel"
                placeholder="+33 6 12 34 56 78"
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-200 md:col-span-2">
              Pseudo
              <input
                className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                name="username"
                type="text"
                placeholder="ShadowFox"
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-200 md:col-span-2">
              Choix du mot de passe
              <input
                className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              className="flex-1 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-6 py-3 text-center text-base font-semibold text-slate-200 transition hover:bg-[var(--surface-strong)]"
              href="/"
            >
              Retour
            </a>
            <button
              className="flex-1 rounded-full bg-[var(--brand-1)] px-6 py-3 text-base font-semibold text-white shadow-[0_12px_28px_rgba(0,212,255,0.35)] transition hover:-translate-y-0.5"
              type="submit"
            >
              Créer mon compte
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
