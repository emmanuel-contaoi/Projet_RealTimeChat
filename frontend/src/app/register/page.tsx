"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { authService } from '@/services/api';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function InscriptionPage() {
  const t = useTranslations('register');
  const tc = useTranslations('common');

  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '', password: '', firstName: '', lastName: '', username: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.register(
        formData.email, formData.password,
        formData.firstName || undefined,
        formData.lastName || undefined,
        formData.username || undefined
      );
      router.push("/conversations");
    } catch (err: any) {
      const message = err.response?.data;
      setError(typeof message === 'string' ? message : t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,77,255,0.35),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />
      <div className="absolute right-6 top-6 z-10">
        <LanguageSwitcher />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-none flex-col items-center justify-center gap-8 px-8 py-12 text-center md:px-12">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">{t('title')}</p>
          <h1 className="font-display text-3xl text-white md:text-4xl">{t('subtitle')}</h1>
        </div>

        <form className="w-full max-w-2xl rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 text-left shadow-[0_14px_30px_rgba(6,10,20,0.5)]" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-slate-200">
              {t('last_name')}
              <input className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]" name="lastName" type="text" value={formData.lastName} onChange={handleChange} placeholder={t('last_name_placeholder')} />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-200">
              {t('first_name')}
              <input className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]" name="firstName" type="text" value={formData.firstName} onChange={handleChange} placeholder={t('first_name_placeholder')} />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-200 md:col-span-2">
              {t('email')}
              <input className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]" name="email" type="email" value={formData.email} onChange={handleChange} placeholder={t('email_placeholder')} required />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-200 md:col-span-2">
              {t('username')}
              <input className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]" name="username" type="text" value={formData.username} onChange={handleChange} placeholder={t('username_placeholder')} maxLength={20} />
            </label>

            <label className="flex flex-col gap-2 text-sm text-slate-200 md:col-span-2">
              {t('password')}
              <input className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]" name="password" type="password" value={formData.password} onChange={handleChange} placeholder={t('password_placeholder')} required />
            </label>
          </div>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a className="flex-1 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-6 py-3 text-center text-base font-semibold text-slate-200 transition hover:bg-[var(--surface-strong)]" href="/">
              {tc('back')}
            </a>
            <button className="flex-1 rounded-full bg-[var(--brand-1)] px-6 py-3 text-base font-semibold text-white shadow-[0_12px_28px_rgba(0,212,255,0.35)] transition hover:-translate-y-0.5 disabled:opacity-50" type="submit" disabled={loading}>
              {loading ? t('submitting') : t('submit')}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
