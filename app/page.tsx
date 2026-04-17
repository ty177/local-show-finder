"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import PlaylistPicker from "@/components/PlaylistPicker";
import ZipCodeInput from "@/components/ZipCodeInput";
import type { Artist } from "@/lib/types";

interface ImportResult {
  artistCount: number;
  songCount: number;
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [zipCode, setZipCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = useCallback((result: ImportResult) => {
    setImportResult(result);
    setError(null);
  }, []);

  const handleFindShows = async () => {
    if (!importResult || importResult.artistCount === 0) {
      setError("Import your playlists first.");
      return;
    }
    if (zipCode.length !== 5) {
      setError("Enter a valid 5-digit zip code.");
      return;
    }

    const storedArtists = localStorage.getItem("showfinder_artists");
    if (!storedArtists) {
      setError("Artist data not found. Please re-import your playlists.");
      return;
    }

    setError(null);
    setIsSearching(true);

    try {
      const artists: Artist[] = JSON.parse(storedArtists);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip: zipCode, artists }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to search for events.");
        return;
      }

      localStorage.setItem("showfinder_zip", zipCode);
      localStorage.setItem("showfinder_events", JSON.stringify(data.events));
      localStorage.setItem("showfinder_artistCount", String(data.artistCount));
      if (data.feedToken) {
        localStorage.setItem("showfinder_feedToken", data.feedToken);
      }
      router.push("/calendar");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mb-6 text-5xl">🎸</div>
          <h1 className="text-3xl font-bold tracking-tight">
            Local Show Finder
          </h1>
          <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400">
            Connect your Spotify, find upcoming concerts near you, and subscribe
            to a live calendar feed.
          </p>
          <button
            onClick={() => signIn("spotify")}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#1DB954] px-8 py-3 text-lg font-semibold text-white shadow-sm transition-all hover:bg-[#1ed760]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            Continue with Spotify
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Find Local Shows
        </h1>
        <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400">
          Pick your Spotify playlists and discover upcoming concerts near you.
        </p>
      </div>

      <div className="space-y-8">
        {/* Step 1: Pick playlists */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              1
            </span>
            <h2 className="text-lg font-semibold">Import Playlists</h2>
          </div>
          <PlaylistPicker onImportComplete={handleImport} />
          {importResult && (
            <div className="mt-4 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-900/20">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                Imported {importResult.artistCount} artists and{" "}
                {importResult.songCount} songs from Spotify.
              </p>
            </div>
          )}
        </section>

        {/* Step 2: Zip code */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              2
            </span>
            <h2 className="text-lg font-semibold">Set Your Location</h2>
          </div>
          <ZipCodeInput onZipChange={setZipCode} />
        </section>

        {/* Step 3: Find shows */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              3
            </span>
            <h2 className="text-lg font-semibold">Find Shows</h2>
          </div>
          <button
            onClick={handleFindShows}
            disabled={isSearching || !importResult || zipCode.length !== 5}
            className="w-full rounded-xl bg-emerald-600 px-6 py-3 text-lg font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-700 dark:hover:bg-emerald-600"
          >
            {isSearching ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Searching Ticketmaster...
              </span>
            ) : (
              "Find Shows Near Me"
            )}
          </button>

          {error && (
            error.toLowerCase().includes("rate limit") ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  &#9203; Daily API Limit Reached
                </p>
                <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                  The Ticketmaster API limit has been exceeded for today. Please
                  try again tomorrow — the limit resets at midnight.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )
          )}
        </section>
      </div>
    </div>
  );
}
