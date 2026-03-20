'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/services/api';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function ConnexionPage() {
  const t = useTranslations('login');
  const tc = useTranslations('common');

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
      // NOUVEAU: On sauvegarde l'email dans le cache du navigateur
      localStorage.setItem("user_email", email); 
      router.push('/conversations');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: string } };
      setError(axiosErr.response?.data || t('error_invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.35),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />
      <div className="absolute right-6 top-6 z-10">
        <LanguageSwitcher />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-8 px-6 py-12 text-center">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
            {t('title')}
          </p>
          <h1 className="font-display text-3xl text-white md:text-4xl">
            {t('subtitle')}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 text-left shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm text-slate-200">
              {t('email')}
              <input
                className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('email_placeholder')}
                required
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-200">
              {t('password')}
              <input
                className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('password_placeholder')}
                required
              />
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                className="flex-1 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-6 py-3 text-center text-sm font-semibold text-slate-200 transition hover:bg-[var(--surface-strong)]"
                href="/"
              >
                {tc('back')}
              </Link>
              <button
                className="flex-1 rounded-full bg-[var(--brand-1)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(0,212,255,0.35)] transition hover:-translate-y-0.5 disabled:opacity-50"
                type="submit"
                disabled={loading}
              >
                {loading ? t('submitting') : t('submit')}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}