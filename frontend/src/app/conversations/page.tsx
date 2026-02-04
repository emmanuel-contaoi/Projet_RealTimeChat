"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const servers = [
  {
    name: "Gaming",
    members: "120 membres",
    status: "En ligne",
    channels: ["general", "annonces", "clips"],
  },
  {
    name: "Travail",
    members: "45 membres",
    status: "Actif",
    channels: ["general", "planning", "projets"],
  },
];

const friends = [
  {
    name: "Alex",
    status: "En ligne",
    lastMessage: "Salut !",
  },
  {
    name: "Sarah",
    status: "Actif",
    lastMessage: "Tu es dispo ce soir ?",
  },
  {
    name: "Nina",
    status: "Absent",
    lastMessage: "Je te reponds plus tard.",
  },
];

type UserSearchResult = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  created_at: string;
};

const channelMessages: Record<
  string,
  { sender: string; text: string; time: string; me: boolean }[]
> = {
  general: [
    { sender: "Alex", text: "Salut !", time: "18:42", me: false },
    { sender: "Moi", text: "Salut, tu veux jouer ?", time: "18:43", me: true },
    {
      sender: "Alex",
      text: "Oui, une petite partie ?",
      time: "18:44",
      me: false,
    },
  ],
  annonces: [
    {
      sender: "Moi",
      text: "Bienvenue sur le serveur !",
      time: "10:12",
      me: true,
    },
  ],
  clips: [
    {
      sender: "Alex",
      text: "Regarde ce highlight.",
      time: "21:08",
      me: false,
    },
  ],
  planning: [
    {
      sender: "Sarah",
      text: "Reunion a 14h.",
      time: "09:15",
      me: false,
    },
  ],
  projets: [
    {
      sender: "Moi",
      text: "Je pousse la V2 demain.",
      time: "16:30",
      me: true,
    },
  ],
};

export default function ConversationsPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [serverList, setServerList] = useState(servers);
  const [friendList, setFriendList] = useState(friends);
  const [selectedServer, setSelectedServer] = useState(
    servers[0]?.name ?? ""
  );
  const [selectedChannel, setSelectedChannel] = useState(
    servers[0]?.channels?.[0] ?? ""
  );
  const [activeTab, setActiveTab] = useState<"servers" | "friends">("servers");
  const [selectedFriend, setSelectedFriend] = useState(
    friends[0]?.name ?? ""
  );
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState<UserSearchResult[]>([]);
  const [allUsers, setAllUsers] = useState<UserSearchResult[]>([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState("");
  const [newServerName, setNewServerName] = useState("");
  const [newServerMembers, setNewServerMembers] = useState("");
  const [newServerStatus, setNewServerStatus] = useState("Actif");
  const [isAddChannelOpen, setIsAddChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [channelList, setChannelList] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isAuthed = !!localStorage.getItem("token");
    if (!isAuthed) {
      router.replace("/connexion");
      return;
    }
    setIsReady(true);
  }, [router]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  const handleSwitchAccount = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/connexion");
  };

  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  const getServerChannels = (serverName: string) =>
    serverList.find((server) => server.name === serverName)?.channels ?? [];

  const handleSelectServer = (serverName: string) => {
    setSelectedServer(serverName);
    const channels = getServerChannels(serverName);
    setSelectedChannel(channels[0] ?? "");
  };

  const handleSelectFriend = (friendName: string) => {
    setSelectedFriend(friendName);
  };

  const handleRemoveFriend = (friendName: string) => {
    setFriendList((prev) => prev.filter((friend) => friend.name !== friendName));
  };

  const formatUserLabel = (user: UserSearchResult) => {
    const fullName = [user.first_name, user.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    return user.username || fullName || user.email;
  };

  const handleAddFriend = (user: UserSearchResult) => {
    const label = formatUserLabel(user);
    setFriendList((prev) => {
      if (prev.some((friend) => friend.name.toLowerCase() === label.toLowerCase())) {
        return prev;
      }
      return [
        ...prev,
        { name: label, status: "Nouveau", lastMessage: "Demande envoyee." },
      ];
    });
    setSelectedFriend(label);
    setFriendSearch("");
    setFriendResults([]);
    setFriendSearchError("");
  };

  useEffect(() => {
    const channels = getServerChannels(selectedServer);
    if (!channels.length) {
      setSelectedChannel("");
      return;
    }
    if (!channels.includes(selectedChannel)) {
      setSelectedChannel(channels[0]);
    }
  }, [selectedServer, selectedChannel, serverList]);

  useEffect(() => {
    if (activeTab !== "friends") return;
    if (!friendList.length) {
      setSelectedFriend("");
      return;
    }
    if (!selectedFriend || !friendList.some((friend) => friend.name === selectedFriend)) {
      setSelectedFriend(friendList[0].name);
    }
  }, [activeTab, selectedFriend, friendList]);

  useEffect(() => {
    if (activeTab !== "friends") return;
    const query = friendSearch.trim();
    if (!query) {
      setFriendResults([]);
      setFriendSearchError("");
      if (!allUsers.length) {
        const controller = new AbortController();
        (async () => {
          try {
            setAllUsersLoading(true);
            const token = localStorage.getItem("token");
            const response = await fetch(`${apiBaseUrl}/users`, {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              signal: controller.signal,
            });
            if (!response.ok) {
              throw new Error("Chargement impossible.");
            }
            const data = (await response.json()) as UserSearchResult[];
            setAllUsers(data);
          } catch (error) {
            if ((error as Error).name === "AbortError") return;
            setFriendSearchError(
              "Impossible de charger la liste des utilisateurs."
            );
          } finally {
            setAllUsersLoading(false);
          }
        })();
        return () => controller.abort();
      }
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setFriendSearchLoading(true);
        setFriendSearchError("");
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${apiBaseUrl}/users/search?q=${encodeURIComponent(query)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Recherche impossible.");
        }

        const data = (await response.json()) as UserSearchResult[];
        setFriendResults(data);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setFriendSearchError("Impossible de charger les utilisateurs.");
      } finally {
        setFriendSearchLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [activeTab, apiBaseUrl, friendSearch, allUsers.length]);

  const handleCreateServer = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newServerName.trim();
    if (!trimmedName) return;

    const membersValue = newServerMembers.trim() || "1 membre";
    const channelsValue = channelList.length ? channelList : ["general"];

    const nextServer = {
      name: trimmedName,
      members: membersValue,
      status: newServerStatus,
      channels: channelsValue,
    };

    setServerList((prev) => [nextServer, ...prev]);
    setSelectedServer(trimmedName);
    setSelectedChannel(channelsValue[0] ?? "");
    setIsCreateServerOpen(false);
    setNewServerName("");
    setNewServerMembers("");
    setNewServerStatus("Actif");
    setChannelList([]);
  };

  const handleAddChannel = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newChannelName.trim();
    if (!trimmedName) return;

    setChannelList((prev) => {
      if (
        prev.some(
          (channel) => channel.toLowerCase() === trimmedName.toLowerCase()
        )
      ) {
        return prev;
      }
      return [...prev, trimmedName];
    });

    setNewChannelName("");
    setIsAddChannelOpen(false);
  };

  if (!isReady) {
    return (
      <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.35),_transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-none items-center justify-center px-6">
          <p className="text-sm text-slate-300">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.35),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />

      <header className="relative z-30 mx-auto flex w-full max-w-none flex-wrap items-center justify-between gap-4 px-8 py-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="relative z-20" ref={menuRef}>
            <button
              className="flex items-center gap-3 rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--surface-strong)]"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              type="button"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-strong)] text-[var(--brand-1)]">
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M20 21a8 8 0 0 0-16 0"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              Profil
            </button>

            {isMenuOpen ? (
              <div className="absolute left-0 z-50 mt-3 w-56 rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-2 text-sm shadow-[0_14px_30px_rgba(6,10,20,0.55)]">
                <button
                  className="w-full rounded-xl px-3 py-2 text-left text-slate-200 transition hover:bg-[var(--surface-strong)]"
                  onClick={() => {
                    setIsMenuOpen(false);
                    router.push("/inscription");
                  }}
                  type="button"
                >
                  Modifier le compte
                </button>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left text-slate-200 transition hover:bg-[var(--surface-strong)]"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleSwitchAccount();
                  }}
                  type="button"
                >
                  Changer de compte
                </button>
                <button
                  className="w-full rounded-xl px-3 py-2 text-left text-rose-200 transition hover:bg-[rgba(255,77,255,0.12)]"
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleLogout();
                  }}
                  type="button"
                >
                  Deconnexion
                </button>
              </div>
            ) : null}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Conversations
            </p>
            <h1 className="font-display text-2xl text-white">
              Serveurs et discussions
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4 text-base font-semibold">
          <button className="rounded-full bg-[var(--brand-1)] px-6 py-3 text-white shadow-[0_10px_24px_rgba(0,212,255,0.35)] transition hover:-translate-y-0.5">
            Nouvelle discussion
          </button>
        </div>
      </header>

      <main
        className={`relative z-10 grid w-full max-w-none flex-1 gap-6 px-8 pb-0 md:px-12 ${
          activeTab === "friends"
            ? "grid-cols-[320px_1fr]"
            : "grid-cols-[260px_220px_1fr]"
        }`}
      >
        <aside className="h-full rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <button
                  className={`text-sm font-semibold transition ${
                    activeTab === "servers"
                      ? "text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                  onClick={() => setActiveTab("servers")}
                  type="button"
                >
                  Serveurs
                </button>
                <button
                  className={`text-sm font-semibold transition ${
                    activeTab === "friends"
                      ? "text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                  onClick={() => setActiveTab("friends")}
                  type="button"
                >
                  Amis
                </button>
              </div>
              <span className="text-xs text-slate-400">
                {activeTab === "servers"
                  ? `${serverList.length} actifs`
                  : `${friendList.length} amis`}
              </span>
            </div>

            {activeTab === "servers" ? (
              <>
                <button
                  className="mt-4 w-full rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-left text-sm font-semibold text-[var(--brand-1)] transition hover:-translate-y-0.5 hover:bg-[var(--surface)]"
                  onClick={() => setIsCreateServerOpen(true)}
                  type="button"
                >
                  + Créer un serveur
                </button>
                <div className="mt-4 flex flex-col gap-3">
                  {serverList.map((server) => (
                    <div
                      key={server.name}
                      className={`flex cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-3 transition ${
                        selectedServer === server.name
                          ? "border-[var(--brand-1)] bg-[rgba(0,212,255,0.12)]"
                          : "border-[var(--stroke)] bg-[var(--surface-strong)] hover:bg-[var(--surface)]"
                      }`}
                      onClick={() => handleSelectServer(server.name)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          handleSelectServer(server.name);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">
                          {server.name}
                        </p>
                        <span className="rounded-full bg-[rgba(0,212,255,0.2)] px-2 py-1 text-[10px] font-semibold text-[var(--brand-1)]">
                          {server.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{server.members}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {friendList.map((friend) => (
                  <div
                    key={friend.name}
                    className={`flex cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition ${
                      selectedFriend === friend.name
                        ? "border-[var(--brand-1)] bg-[rgba(0,212,255,0.12)]"
                        : "border-[var(--stroke)] bg-[var(--surface-strong)] hover:bg-[var(--surface)]"
                    }`}
                    onClick={() => handleSelectFriend(friend.name)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        handleSelectFriend(friend.name);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">
                        {friend.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[rgba(0,212,255,0.2)] px-2 py-1 text-[10px] font-semibold text-[var(--brand-1)]">
                          {friend.status}
                        </span>
                        <button
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--stroke)] bg-[var(--surface)] text-slate-300 transition hover:bg-[rgba(255,77,255,0.12)]"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveFriend(friend.name);
                          }}
                          type="button"
                          aria-label={`Supprimer ${friend.name}`}
                          title="Supprimer"
                        >
                          <svg
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M3 6h18"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M8 6V4h8v2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M6 6l1 14h10l1-14"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </aside>

        {activeTab === "servers" ? (
          <section className="h-full rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-5 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Channels</p>
              <span className="text-xs text-slate-400">
                {getServerChannels(selectedServer).length}
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {getServerChannels(selectedServer).length ? (
                getServerChannels(selectedServer).map((channel) => (
                  <button
                    key={channel}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      selectedChannel === channel
                        ? "border-[var(--brand-1)] bg-[rgba(0,212,255,0.12)] text-white"
                        : "border-[var(--stroke)] bg-[var(--surface-strong)] text-slate-200 hover:bg-[var(--surface)]"
                    }`}
                    onClick={() => setSelectedChannel(channel)}
                    type="button"
                  >
                    <span className="truncate">#{channel}</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      Actif
                    </span>
                  </button>
                ))
              ) : (
                <p className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
                  Aucun channel pour ce serveur.
                </p>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "servers" ? (
          <section className="flex h-full flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
            <div className="flex items-center justify-between border-b border-[var(--stroke)] px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  {selectedChannel ? `#${selectedChannel}` : "Conversation"}
                </p>
                <p className="text-xs text-slate-400">
                  {selectedServer || "Aucun serveur"}
                </p>
              </div>
              <span className="rounded-full bg-[rgba(0,212,255,0.2)] px-2 py-1 text-[10px] font-semibold text-[var(--brand-1)]">
                Actif
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-3 px-5 py-4">
              {selectedChannel &&
              (channelMessages[selectedChannel]?.length ?? 0) > 0 ? (
                channelMessages[selectedChannel].map((message, index) => (
                  <div
                    key={`${message.sender}-${index}`}
                    className={`flex ${
                      message.me ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                        message.me
                          ? "bg-[var(--brand-1)] text-slate-900"
                          : "bg-[var(--surface-strong)] text-slate-200"
                      }`}
                    >
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                        {message.sender}
                      </p>
                      <p>{message.text}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {message.time}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
                  Aucun message dans ce channel.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-[var(--stroke)] px-5 py-4">
              <div className="flex-1 rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
                Ecris un message...
              </div>
              <button
                className="rounded-full bg-[var(--brand-1)] px-5 py-2.5 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!selectedChannel}
              >
                Envoyer
              </button>
            </div>
          </section>
        ) : (
          <section className="flex h-full flex-col rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[0_14px_30px_rgba(6,10,20,0.5)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">
                  Trouver des utilisateurs
                </p>
                <p className="text-xs text-slate-400">
                  Recherche et ajoute de nouveaux amis
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <label className="grid gap-2 text-sm text-slate-200">
                Rechercher
                <input
                  className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                  value={friendSearch}
                  onChange={(event) => setFriendSearch(event.target.value)}
                  placeholder="Pseudo, email, prenom..."
                />
              </label>

              {friendSearchError ? (
                <p className="text-xs text-rose-200">{friendSearchError}</p>
              ) : null}

              {friendSearchLoading ? (
                <p className="text-xs text-slate-400">Recherche en cours...</p>
              ) : null}

              {friendSearch.trim() && !friendSearchLoading ? (
                friendResults.length ? (
                  <div className="flex max-h-[55vh] flex-col gap-2 overflow-auto pr-1">
                    {friendResults.map((user) => {
                      const label = formatUserLabel(user);
                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3"
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {label}
                            </p>
                            <p className="text-xs text-slate-400">
                              {user.email}
                            </p>
                          </div>
                          <button
                            className="rounded-full bg-[var(--brand-1)] px-4 py-2 text-xs font-semibold text-slate-900"
                            onClick={() => handleAddFriend(user)}
                            type="button"
                          >
                            +
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
                    Aucun utilisateur trouve.
                  </p>
                )
              ) : (
                <div className="flex flex-col gap-2">
                  {allUsersLoading ? (
                    <p className="text-xs text-slate-400">
                      Chargement des utilisateurs...
                    </p>
                  ) : allUsers.length ? (
                    <div className="flex max-h-[55vh] flex-col gap-2 overflow-auto pr-1">
                      {allUsers.map((user) => {
                        const label = formatUserLabel(user);
                        return (
                          <div
                            key={user.id}
                            className="flex items-center justify-between rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3"
                          >
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {label}
                              </p>
                              <p className="text-xs text-slate-400">
                                {user.email}
                              </p>
                            </div>
                            <button
                              className="rounded-full bg-[var(--brand-1)] px-4 py-2 text-xs font-semibold text-slate-900"
                              onClick={() => handleAddFriend(user)}
                              type="button"
                            >
                              +
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-xs text-slate-400">
                      Aucun utilisateur disponible.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {isCreateServerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-[rgba(5,12,25,0.75)] backdrop-blur-sm"
            onClick={() => setIsCreateServerOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[0_20px_40px_rgba(6,10,20,0.6)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Serveur
                </p>
                <h2 className="font-display text-2xl text-white">
                  Créer un serveur
                </h2>
              </div>
              <button
                className="rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-1 text-xs text-slate-200 transition hover:bg-[var(--surface)]"
                onClick={() => setIsCreateServerOpen(false)}
                type="button"
              >
                Fermer
              </button>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={handleCreateServer}>
              <label className="grid gap-2 text-sm text-slate-200">
                Nom du serveur
                <input
                  className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                  value={newServerName}
                  onChange={(event) => setNewServerName(event.target.value)}
                  placeholder="Ex: Studio"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-200">
                Membres (optionnel)
                <input
                  className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                  value={newServerMembers}
                  onChange={(event) => setNewServerMembers(event.target.value)}
                  placeholder="Ex: 8 membres"
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-200">
                Channels
                <button
                  className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-left text-sm font-semibold text-[var(--brand-1)] transition hover:-translate-y-0.5 hover:bg-[var(--surface)]"
                  onClick={() => setIsAddChannelOpen(true)}
                  type="button"
                >
                  + Ajouter des channels
                </button>
                {channelList.length ? (
                  <div className="flex flex-wrap gap-2">
                    {channelList.map((channel) => (
                      <span
                        key={channel}
                        className="rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-1 text-xs text-slate-200"
                      >
                        #{channel}
                      </span>
                    ))}
                  </div>
                ) : null}
              </label>
              <div className="mt-2 flex items-center justify-between gap-3">
                <button
                  className="rounded-full border border-[var(--stroke)] px-5 py-2.5 text-sm text-slate-200 transition hover:bg-[var(--surface-strong)]"
                  onClick={() => setIsCreateServerOpen(false)}
                  type="button"
                >
                  Annuler
                </button>
                <button
                  className="rounded-full bg-[var(--brand-1)] px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                  disabled={!newServerName.trim()}
                >
                  Créer et ouvrir
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isAddChannelOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-[rgba(5,12,25,0.8)] backdrop-blur-sm"
            onClick={() => setIsAddChannelOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-[var(--stroke)] bg-[var(--surface)] p-6 shadow-[0_20px_40px_rgba(6,10,20,0.6)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Channel
                </p>
                <h3 className="font-display text-xl text-white">
                  Ajouter un channel
                </h3>
              </div>
              <button
                className="rounded-full border border-[var(--stroke)] bg-[var(--surface-strong)] px-3 py-1 text-xs text-slate-200 transition hover:bg-[var(--surface)]"
                onClick={() => setIsAddChannelOpen(false)}
                type="button"
              >
                Fermer
              </button>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={handleAddChannel}>
              <label className="grid gap-2 text-sm text-slate-200">
                Nom du channel
                <input
                  className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--brand-1)]"
                  value={newChannelName}
                  onChange={(event) => setNewChannelName(event.target.value)}
                  placeholder="Ex: annonces"
                  required
                />
              </label>
              <div className="mt-2 flex items-center justify-between gap-3">
                <button
                  className="rounded-full border border-[var(--stroke)] px-5 py-2.5 text-sm text-slate-200 transition hover:bg-[var(--surface-strong)]"
                  onClick={() => setIsAddChannelOpen(false)}
                  type="button"
                >
                  Annuler
                </button>
                <button
                  className="rounded-full bg-[var(--brand-1)] px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                  disabled={!newChannelName.trim()}
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </div>
  );
}
