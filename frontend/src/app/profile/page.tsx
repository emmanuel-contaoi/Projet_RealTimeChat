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

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const user = authService.getCurrentUser() as any;
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
      setAvatarUrl(user.avatar_url || null);
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

  // NOUVEAU : Fonction pour gérer l'upload de l'avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setAuthError("");
    setSuccessMsg("");

    try {
      const token = localStorage.getItem("token");
      const uploadData = new FormData();
      uploadData.append("avatar", file);

      // On utilise l'URL absolue car c'est un multipart/form-data
      const response = await fetch("http://localhost:3001/users/me/avatar", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: uploadData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Erreur lors de l'envoi de l'image");
      }

      const data = await response.json();
      setAvatarUrl(data.avatar_url);

      // Mettre à jour l'utilisateur dans le localStorage pour que toute l'app soit au courant
      const user = authService.getCurrentUser() as any;
      if (user) {
        user.avatar_url = data.avatar_url;
        localStorage.setItem("user", JSON.stringify(user));
      }

      setSuccessMsg("Photo de profil mise à jour !");
    } catch (error: any) {
      console.error(error);
      setAuthError(error.message || "Erreur d'upload");
    } finally {
      setUploadingAvatar(false);
      // Reset de l'input file pour pouvoir ré-uploader la même image si besoin
      e.target.value = "";
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
              
              {/* NOUVEAU : Zone d'Avatar */}
              <div className="col-span-full mb-4 flex flex-col items-center justify-center gap-3">
                <div className="group relative h-24 w-24 overflow-hidden rounded-full border-4 border-[var(--stroke)] bg-[var(--surface-strong)] transition-all hover:border-[var(--brand-1)]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--brand-2)] to-[var(--brand-1)] text-3xl font-bold text-white">
                      {(formData.username || formData.prenom || formData.email || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/jpg, image/webp, image/gif" 
                      className="hidden" 
                      onChange={handleAvatarChange} 
                      disabled={uploadingAvatar} 
                    />
                  </label>
                </div>
                {uploadingAvatar && <p className="text-xs text-[var(--brand-1)] animate-pulse">Upload en cours...</p>}
              </div>

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
              {successMsg && <p className="col-span-full mt-2 text-sm text-emerald-400 text-center">{successMsg}</p>}

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