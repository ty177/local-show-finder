"use client";

import { useState, useEffect } from "react";

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  imageUrl: string;
  owner: string;
  ownerId: string;
  restricted: boolean;
}

interface ImportResult {
  artistCount: number;
  songCount: number;
}

export default function PlaylistPicker({
  onImportComplete,
}: {
  onImportComplete: (result: ImportResult) => void;
}) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeLiked, setIncludeLiked] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/playlists");
        const data = await res.json();
        if (cancelled) return;

        if (!res.ok) {
          setError(data.error || "Failed to load playlists");
          return;
        }

        setPlaylists(data.playlists || []);
      } catch {
        if (!cancelled) setError("Network error loading playlists.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    const selectable = playlists.filter((p) => !p.restricted);
    if (selectedIds.size === selectable.length && selectable.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map((p) => p.id)));
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0 && !includeLiked) {
      setError("Select at least one playlist or Liked Songs.");
      return;
    }

    setError(null);
    setImporting(true);

    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistIds: Array.from(selectedIds),
          includeLikedSongs: includeLiked,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        return;
      }

      localStorage.setItem(
        "showfinder_artists",
        JSON.stringify(data.artists)
      );

      onImportComplete({
        artistCount: data.artistCount,
        songCount: data.songCount,
      });
    } catch {
      setError("Network error during import.");
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="text-center">
          <div className="mb-3 inline-block h-6 w-6 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Loading your playlists…
          </p>
        </div>
      </div>
    );
  }

  if (error && playlists.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  const totalSelected =
    selectedIds.size + (includeLiked ? 1 : 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={toggleAll}
          className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
        >
          {selectedIds.size === playlists.length && playlists.length > 0
            ? "Deselect all"
            : "Select all"}
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {totalSelected} selected
        </span>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        {/* Liked Songs row */}
        <label className="flex cursor-pointer items-center gap-3 border-b border-zinc-100 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-700/50">
          <input
            type="checkbox"
            checked={includeLiked}
            onChange={(e) => setIncludeLiked(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div className="flex h-10 w-10 items-center justify-center rounded bg-gradient-to-br from-purple-500 to-pink-500 text-lg">
            ❤️
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Liked Songs</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Your saved tracks
            </p>
          </div>
        </label>

        {playlists.map((p) => (
          <label
            key={p.id}
            className={`flex items-center gap-3 border-b border-zinc-100 p-3 transition-colors last:border-0 dark:border-zinc-700 ${
              p.restricted
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
            }`}
            title={
              p.restricted
                ? "Spotify-owned playlists can't be imported (editorial/algorithmic content)"
                : undefined
            }
          >
            <input
              type="checkbox"
              checked={selectedIds.has(p.id)}
              onChange={() => !p.restricted && toggle(p.id)}
              disabled={p.restricted}
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
            />
            {p.imageUrl ? (
              <img
                src={p.imageUrl}
                alt=""
                className="h-10 w-10 rounded object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-200 dark:bg-zinc-600 text-sm">
                🎵
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-semibold">
                {p.name}
                {p.restricted && (
                  <span className="shrink-0 rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    Spotify-owned
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {p.trackCount} track{p.trackCount === 1 ? "" : "s"}
                {p.owner ? ` · ${p.owner}` : ""}
              </p>
            </div>
          </label>
        ))}

        {playlists.length === 0 && (
          <div className="p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No playlists found in your Spotify account.
          </div>
        )}
      </div>

      <button
        onClick={handleImport}
        disabled={importing || totalSelected === 0}
        className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {importing ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Importing tracks from Spotify…
          </span>
        ) : (
          `Import ${totalSelected} ${totalSelected === 1 ? "selection" : "selections"}`
        )}
      </button>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
