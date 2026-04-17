"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { format, parseISO } from "date-fns";
import SpotifyEmbed from "@/components/SpotifyEmbed";
import type { EventData } from "@/lib/types";

export default function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      setLoading(false);
      return;
    }

    // Read events from localStorage cache
    const cachedEvents = localStorage.getItem("showfinder_events");
    if (cachedEvents) {
      try {
        const events: EventData[] = JSON.parse(cachedEvents);
        const found = events.find((e) => e.id === id);
        setEvent(found || null);
      } catch {
        // ignore parse errors
      }
    }
    setLoading(false);
  }, [id, session, status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
        <div>
          <p className="text-lg text-zinc-500 dark:text-zinc-400">
            Sign in to view event details.
          </p>
          <button
            onClick={() => signIn()}
            className="mt-4 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-lg text-zinc-500">Event not found.</p>
        <Link
          href="/calendar"
          className="mt-4 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          Back to Calendar
        </Link>
      </div>
    );
  }

  const date = parseISO(event.date);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/calendar"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Back to Calendar
      </Link>

      {/* Hero image */}
      {event.imageUrl && (
        <div className="mb-6 overflow-hidden rounded-2xl">
          <img
            src={event.imageUrl}
            alt={event.name}
            className="h-64 w-full object-cover sm:h-80"
          />
        </div>
      )}

      {/* Event info */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            {format(date, "EEEE, MMMM d, yyyy")}
            {event.time &&
              ` at ${format(new Date(`2000-01-01T${event.time}`), "h:mm a")}`}
          </span>
          {event.generalAdmission && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              General Admission Only
            </span>
          )}
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {event.name}
        </h1>
        <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
          {event.venue}
        </p>
        {event.venueAddress && (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            {event.venueAddress}
          </p>
        )}
        {event.priceRange && (
          <p className="mt-2 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
            {event.priceRange}
          </p>
        )}

        {/* Buy tickets button */}
        <a
          href={event.ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-lg font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md"
        >
          Buy Tickets
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
            />
          </svg>
        </a>
      </div>

      {/* Matched artists and songs */}
      <div className="space-y-8">
        {event.matchedArtists.map((artist) => (
          <section
            key={artist.name}
            className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800/50"
          >
            <h2 className="mb-1 text-xl font-bold">{artist.name}</h2>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              {artist.songs.length} song{artist.songs.length !== 1 ? "s" : ""}{" "}
              from your playlists
            </p>

            <div className="space-y-3">
              {artist.songs.map((song) => (
                <SpotifyEmbed
                  key={`${song.title}-${song.spotifyTrackId}`}
                  trackId={song.spotifyTrackId}
                  title={`${song.title} - ${song.album}`}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
