"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { authService } from "@/services/api";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function ProfilePage() {
  const router = useRouter();
  const t = useTranslations("profile");
  const tc = useTranslations("common");

  // États pour la sécurité
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordVerify, setPasswordVerify] = useState("");
  const [authError, setAuthError] = useState("");

  // États pour le formulaire de profil
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    email: "",
    username: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (!user) {
      router.push("/login");
    } else {
      setFormData((prev) => ({
        ...prev,
        nom: user.last_name || "",
        prenom: user.first_name || "",
        email: user.email || "",
        username: user.username || "",
      }));
    }
  }, [router]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    try {
      const user = authService.getCurrentUser();
      const hiddenEmail = user?.email || localStorage.getItem("user_email");

      if (!hiddenEmail) {
        setAuthError(t("error_session"));
        setLoading(false);
        return;
      }

      await authService.login(hiddenEmail, passwordVerify);
      setIsUnlocked(true);
    } catch {
      setAuthError(t("error_wrong_password"));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg("");
    setAuthError("");

    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setAuthError(t("error_password_mismatch"));
      setLoading(false);
      return;
    }

    try {
      const updatedUser = await authService.updateProfile({
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        username: formData.username,
        newPassword: formData.newPassword,
      });

      if (updatedUser && updatedUser.email) {
        localStorage.setItem("user_email", updatedUser.email);
      }

      setSuccessMsg(t("success_update"));

      setTimeout(() => {
        window.location.href = "/conversations";
      }, 1500);
    } catch (error) {
      console.error(error);
      setAuthError(t("error_update"));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,77,255,0.35),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />
      <div className="absolute right-6 top-6 z-50">
        <LanguageSwitcher />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-none flex-col items-center justify-center gap-8 px-8 py-12 text-center md:px-12">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
            {isUnlocked ? t("settings") : t("security")}
          </p>
          <h1 className="font-display text-3xl text-white md:text-4xl">
            {isUnlocked ? t("edit_account") : t("unlock_title")}
          </h1>
        </div>

        <div className="w-full max-w-2xl rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 text-left shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
          {!isUnlocked ? (
            <form onSubmit={handleUnlock} className="flex flex-col gap-6" autoComplete="off">
              <p className="text-sm text-slate-400 text-center">
                {t("unlock_description")}
              </p>

              <label className="flex flex-col gap-2 text-sm text-slate-200">
                {t("current_password")}
                <input
                  type="password"
                  name="verify-password"
                  autoComplete="new-password"
                  className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                  value={passwordVerify}
                  onChange={(e) => setPasswordVerify(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </label>

              {authError && <p className="text-sm text-rose-500 text-center">{authError}</p>}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/conversations")}
                  className="flex-1 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-6 py-3 text-center text-base font-semibold text-slate-200 transition hover:bg-[var(--surface-strong)]"
                >
                  {tc("back")}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-full bg-[var(--brand-1)] px-6 py-3 text-base font-semibold text-white shadow-[0_12px_28px_rgba(0,212,255,0.35)] transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {loading ? t("verifying") : t("unlock_button")}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSaveProfile} className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-slate-200">
                {t("last_name")}
                <input className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]" name="nom" type="text" value={formData.nom} onChange={handleChange} />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-200">
                {t("first_name")}
                <input className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]" name="prenom" type="text" value={formData.prenom} onChange={handleChange} />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-200 md:col-span-2">
                {t("email")}
                <input className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]" name="email" type="email" value={formData.email} onChange={handleChange} required />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-200 md:col-span-2">
                {t("username")}
                <input className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]" name="username" type="text" value={formData.username} onChange={handleChange} maxLength={20} />
              </label>

              <div className="col-span-full my-2">
                <hr className="border-[var(--stroke)]" />
                <p className="mt-2 text-xs text-slate-400">{t("password_help")}</p>
              </div>

              <label className="flex flex-col gap-2 text-sm text-slate-200 md:col-span-2">
                {t("new_password")}
                <input className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)] placeholder:text-slate-600" name="newPassword" type="password" value={formData.newPassword} onChange={handleChange} placeholder="••••••••" />
              </label>

              <label className="flex flex-col gap-2 text-sm text-slate-200 md:col-span-2">
                {t("confirm_password")}
                <input className="w-full rounded-2xl border border-[var(--stroke)] bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)] placeholder:text-slate-600" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} placeholder="••••••••" />
              </label>

              {authError && <p className="col-span-full mt-2 text-sm text-rose-500 text-center">{authError}</p>}
              {successMsg && <p className="col-span-full mt-2 text-sm text-green-400 text-center">{successMsg}</p>}

              <div className="col-span-full mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/conversations")}
                  className="flex-1 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-6 py-3 text-center text-base font-semibold text-slate-200 transition hover:bg-[var(--surface-strong)]"
                >
                  {tc("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-full bg-[var(--brand-1)] px-6 py-3 text-base font-semibold text-white shadow-[0_12px_28px_rgba(0,212,255,0.35)] transition hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {loading ? tc("saving") : tc("save")}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}