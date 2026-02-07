'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/api';

export default function ConnexionPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.login(email, password);
      router.push('/conversations'); // Redirige vers le dashboard de ton ami
    } catch (err: any) {
      setError(err.response?.data || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.35),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-8 px-6 py-12 text-center">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
            Connexion
          </p>
          <h1 className="font-display text-3xl text-white md:text-4xl">
            Heureux de te revoir
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 text-left shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
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

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <a
                className="flex-1 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-6 py-3 text-center text-sm font-semibold text-slate-200 transition hover:bg-[var(--surface-strong)]"
                href="/"
              >
                Retour
              </a>
              <button
                className="flex-1 rounded-full bg-[var(--brand-1)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(0,212,255,0.35)] transition hover:-translate-y-0.5 disabled:opacity-50"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
