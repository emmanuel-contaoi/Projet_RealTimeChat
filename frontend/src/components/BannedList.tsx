'use client';

import { useEffect, useState } from 'react';
import { serversService } from '@/services/api';

// Adapte ces types si tu as un fichier de types global
interface BannedUser {
  id: string;
  username: string;
  expires_at: string | null;
  created_at: string | null;
}

interface BannedListProps {
  serverId: string;
  onClose: () => void;
}

export default function BannedList({ serverId, onClose }: BannedListProps) {
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBans();
  }, [serverId]);

  const fetchBans = async () => {
    try {
      setIsLoading(true);
      const data = await serversService.bans(serverId);
      setBannedUsers(data);
    } catch (err) {
      setError("Impossible de charger la liste des bannis.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      await serversService.unban(serverId, userId);
      // Met à jour la liste en retirant l'utilisateur débanni
      setBannedUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      alert("Erreur lors du débannissement");
    }
  };

  return (
    <div className="absolute inset-0 bg-[var(--surface-color)] z-50 flex flex-col h-full bg-gray-900 text-white">
      {/* En-tête de la liste des bans */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-red-400">Membres Bannis</h2>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-gray-800 rounded-md text-gray-400 hover:text-white"
        >
          ✕ Retour
        </button>
      </div>

      {/* Liste des utilisateurs */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-gray-400 text-center mt-4">Chargement...</p>
        ) : error ? (
          <p className="text-red-400 text-center mt-4">{error}</p>
        ) : bannedUsers.length === 0 ? (
          <p className="text-gray-400 text-center mt-4">Aucun utilisateur banni sur ce serveur.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {bannedUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between bg-gray-800 p-3 rounded-lg border border-gray-700">
                <div className="flex flex-col">
                  <span className="font-semibold">{user.username}</span>
                  <span className="text-xs text-gray-400">
                    Banni le : {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Inconnu'}
                  </span>
                </div>
                <button
                  onClick={() => handleUnban(user.id)}
                  className="px-3 py-1 bg-gray-700 hover:bg-green-600 text-sm font-medium rounded transition-colors"
                >
                  Débannir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}