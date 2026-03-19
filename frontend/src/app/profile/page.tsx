"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/api";

export default function ProfilePage() {
  const router = useRouter();
  
  // États pour la sécurité
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordVerify, setPasswordVerify] = useState("");
  const [authError, setAuthError] = useState("");
  
  // États pour le formulaire de profil (AVEC les champs mot de passe)
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
        setAuthError("Erreur de session. Veuillez vous déconnecter puis vous reconnecter.");
        setLoading(false);
        return;
      }

      await authService.login(hiddenEmail, passwordVerify);
      setIsUnlocked(true);
    } catch (err) {
      setAuthError("Mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg("");
    setAuthError(""); 

    // Vérification : est-ce que les deux mots de passe correspondent ?
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setAuthError("Les nouveaux mots de passe ne correspondent pas !");
      setLoading(false);
      return;
    }

    try {
      // On envoie les données à l'API (le nouveau mot de passe est inclus s'il est rempli)
      const updatedUser = await authService.updateProfile({
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        username: formData.username,
        newPassword: formData.newPassword 
      });
      
      if (updatedUser && updatedUser.email) {
        localStorage.setItem("user_email", updatedUser.email);
      }

      setSuccessMsg("Profil mis à jour avec succès !");
      
      setTimeout(() => {
        window.location.href = "/conversations";
      }, 1500);

    } catch (error) {
      console.error(error);
      setAuthError("Erreur lors de la mise à jour.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-white">
      <div className="w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-8 shadow-2xl">
        
        <h1 className="mb-6 text-center text-2xl font-bold">
          {isUnlocked ? "Modifier mon compte" : "Sécurité du compte"}
        </h1>

        {!isUnlocked ? (
          <form onSubmit={handleUnlock} className="flex flex-col gap-4" autoComplete="off">
            <p className="text-sm text-slate-400 text-center mb-4">
              Veuillez entrer votre mot de passe actuel pour accéder à vos informations.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium">Mot de passe</label>
              <input
                type="password"
                name="verify-password"
                autoComplete="new-password"
                className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-white outline-none focus:border-[var(--brand-1)]"
                value={passwordVerify}
                onChange={(e) => setPasswordVerify(e.target.value)}
                required
              />
            </div>
            {authError && <p className="text-sm text-rose-500">{authError}</p>}
            
            <div className="mt-4 flex gap-4">
              <button type="button" onClick={() => router.push("/conversations")} className="flex-1 rounded-full border border-[var(--stroke)] py-3 transition hover:bg-[var(--surface-strong)]">
                Retour
              </button>
              <button type="submit" disabled={loading} className="flex-1 rounded-full bg-[var(--brand-1)] py-3 font-semibold text-slate-900 transition hover:opacity-90">
                {loading ? "Vérification..." : "Déverrouiller"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            {/* Infos de base */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Nom</label>
                <input type="text" className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 outline-none focus:border-[var(--brand-1)]" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">Prénom</label>
                <input type="text" className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 outline-none focus:border-[var(--brand-1)]" value={formData.prenom} onChange={(e) => setFormData({ ...formData, prenom: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Mail</label>
              <input type="email" className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 outline-none focus:border-[var(--brand-1)]" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Pseudo</label>
              <input type="text" className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 outline-none focus:border-[var(--brand-1)]" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} />
            </div>

            {/* --- NOUVEAUX CHAMPS POUR LE MOT DE PASSE --- */}
            <hr className="my-2 border-[var(--stroke)]" />
            <p className="text-xs text-slate-400">Laissez vide si vous ne souhaitez pas modifier votre mot de passe.</p>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Nouveau mot de passe</label>
              <input type="password" placeholder="••••••••" className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 outline-none focus:border-[var(--brand-1)] placeholder:text-slate-600" value={formData.newPassword} onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Confirmer le nouveau mot de passe</label>
              <input type="password" placeholder="••••••••" className="w-full rounded-lg border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 outline-none focus:border-[var(--brand-1)] placeholder:text-slate-600" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} />
            </div>
            {/* --------------------------------------------- */}

            {authError && <p className="text-sm text-rose-500">{authError}</p>}
            {successMsg && <p className="text-sm text-green-400">{successMsg}</p>}
            
            <div className="mt-4 flex gap-4">
              <button type="button" onClick={() => router.push("/conversations")} className="flex-1 rounded-full border border-[var(--stroke)] py-3 transition hover:bg-[var(--surface-strong)]">Annuler</button>
              <button type="submit" disabled={loading} className="flex-1 rounded-full bg-[var(--brand-1)] py-3 font-semibold text-slate-900 transition hover:opacity-90">{loading ? "Enregistrement..." : "Sauvegarder"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}