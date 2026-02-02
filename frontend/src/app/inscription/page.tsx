"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authService } from '@/services/api';

export default function InscriptionPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.register(email, password);
      router.push("/conversations");
    } catch (err: any) {
      setError(err.response?.data || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,77,255,0.35),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-8 px-6 py-12 text-center">
        <a
          className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-[var(--surface-strong)]"
          href="/"
        >
          Retour
        </a>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
            Création de compte
          </p>
          <h1 className="font-display text-3xl text-white md:text-4xl">
            Rejoins la communauté
          </h1>
        </div>

        <form
          className="w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 text-left shadow-[0_14px_30px_rgba(6,10,20,0.5)]"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm text-slate-200">
              Email
              <input
                className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-200">
              Mot de passe
              <input
                className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              className="mt-2 w-full rounded-full bg-[var(--brand-1)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(0,212,255,0.35)] transition hover:-translate-y-0.5 disabled:opacity-50"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Création...' : 'Créer mon compte'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
