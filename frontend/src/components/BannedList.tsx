"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { authService } from "@/services/api";

type BannedUser = {
  id: string;
  username: string;
  expires_at: string | null;
  created_at: string | null;
};

type BannedListProps = {
  serverId: string;
  onClose?: () => void;
};

export default function BannedList({ serverId, onClose }: BannedListProps) {
  const t = useTranslations("server");
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchBans = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:3001/servers/${serverId}/bans`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erreur de chargement");
      }

      const data = await response.json();
      setBannedUsers(data);
    } catch {
      // CORRECTION ESLINT : "catch (err)" remplacé par "catch" tout court
      setError(t("ban_load_error"));
    } finally {
      setLoading(false);
    }
  }, [serverId, t]); // useCallback a besoin de ses dépendances

  // CORRECTION ESLINT : fetchBans est maintenant dans le tableau de dépendances
  useEffect(() => {
    fetchBans();
  }, [fetchBans]);

  const handleUnban = async (userId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`http://localhost:3001/servers/${serverId}/bans/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Erreur de débannissement");
      }

      // Met à jour la liste localement après un succès
      setBannedUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch {
      // CORRECTION ESLINT : "catch (err)" remplacé par "catch"
      alert(t("unban_error"));
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-slate-400">Chargement...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Utilisateurs bannis</h3>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white" type="button">
            ✕
          </button>
        )}
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {bannedUsers.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun utilisateur banni.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {bannedUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between rounded-xl bg-slate-800/50 p-3 border border-slate-700/50">
              <div>
                <p className="text-sm font-semibold text-white">{user.username}</p>
                <p className="text-xs text-slate-400">
                  {user.expires_at
                    ? `Expire le : ${new Date(user.expires_at).toLocaleDateString("fr-FR")}`
                    : "Bannissement permanent"}
                </p>
              </div>
              <button
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-600"
                onClick={() => handleUnban(user.id)}
                type="button"
              >
                Débannir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}