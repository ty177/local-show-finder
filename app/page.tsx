"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import CsvUploader from "@/components/CsvUploader";
import ZipCodeInput from "@/components/ZipCodeInput";
import type { Artist } from "@/lib/types";

interface UploadResult {
  artistCount: number;
  songCount: number;
}

export default function Home() {
  const router = useRouter();
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [zipCode, setZipCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback((result: UploadResult) => {
    setUploadResult(result);
    setError(null);
  }, []);

  const handleFindShows = async () => {
    if (!uploadResult || uploadResult.artistCount === 0) {
      setError("Upload playlist CSVs first.");
      return;
    }
    if (zipCode.length !== 5) {
      setError("Enter a valid 5-digit zip code.");
      return;
    }

    const storedArtists = localStorage.getItem("showfinder_artists");
    if (!storedArtists) {
      setError("Artist data not found. Please re-upload your CSVs.");
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

      // Cache events in localStorage for the calendar page
      localStorage.setItem("showfinder_zip", zipCode);
      localStorage.setItem("showfinder_events", JSON.stringify(data.events));
      localStorage.setItem("showfinder_artistCount", String(data.artistCount));
      router.push("/calendar");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Find Local Shows
        </h1>
        <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400">
          Upload your Spotify playlist exports and discover upcoming concerts
          near you.
        </p>
      </div>

      <div className="space-y-8">
        {/* Step 1: Upload CSVs */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              1
            </span>
            <h2 className="text-lg font-semibold">Upload Playlists</h2>
          </div>
          <CsvUploader onUploadComplete={handleUpload} />
          {uploadResult && (
            <div className="mt-4 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-900/20">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                Loaded {uploadResult.artistCount} artists and{" "}
                {uploadResult.songCount} songs from your playlists.
              </p>
            </div>
          )}
        </section>

        {/* Step 2: Enter zip code */}
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
            disabled={isSearching || !uploadResult || zipCode.length !== 5}
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

        {/* How to export from Spotify */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800/50">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            How to export your Spotify playlists as CSV
          </h3>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
            <li>
              Go to{" "}
              <a
                href="https://www.exportify.net/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-600 underline dark:text-emerald-400"
              >
                Exportify
              </a>{" "}
              and sign in with your Spotify account
            </li>
            <li>Select the playlists you want to export</li>
            <li>Download each as a CSV file</li>
            <li>Upload the CSV files above</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
