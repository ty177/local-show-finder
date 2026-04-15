"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import EventCalendar from "@/components/EventCalendar";
import EventCard from "@/components/EventCard";
import type { EventData } from "@/lib/types";

export default function CalendarPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zipCode, setZipCode] = useState("");
  const [artistCount, setArtistCount] = useState(0);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [icsUrl, setIcsUrl] = useState("");

  const fetchEvents = useCallback(async (zip: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events?zip=${zip}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setEvents(data.events);
      setArtistCount(data.artistCount || 0);
    } catch {
      setError("Failed to load events. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const zip = localStorage.getItem("showfinder_zip") || "";
    if (zip) {
      setZipCode(zip);
      setIcsUrl(`${window.location.origin}/api/calendar.ics?zip=${zip}`);
      fetchEvents(zip);
    } else {
      setLoading(false);
      setError("No zip code set. Go to the home page to set your location.");
    }
  }, [fetchEvents]);

  const handleCopyIcs = () => {
    navigator.clipboard.writeText(icsUrl);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-zinc-500 dark:text-zinc-400">
            Loading events...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-lg text-red-600 dark:text-red-400">{error}</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Go to Upload Page
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your Show Calendar</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {events.length} upcoming show{events.length !== 1 ? "s" : ""} near{" "}
            {zipCode} from {artistCount} artist
            {artistCount !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700">
            <button
              onClick={() => setView("calendar")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "calendar"
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              } rounded-l-lg`}
            >
              Calendar
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "list"
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              } rounded-r-lg`}
            >
              List
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchEvents(zipCode)}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Refresh
          </button>

          {/* ICS Subscribe */}
          {icsUrl && (
            <button
              onClick={handleCopyIcs}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
              title="Copy .ics URL to subscribe in your calendar app"
            >
              Copy .ics URL
            </button>
          )}
        </div>
      </div>

      {/* ICS URL display */}
      {icsUrl && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
          <p className="mb-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Subscribe to this calendar
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500">
            Add this URL to Google Calendar, Apple Calendar, or Outlook to get
            automatic updates:
          </p>
          <code className="mt-2 block break-all rounded bg-white px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {icsUrl}
          </code>
        </div>
      )}

      {events.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-xl text-zinc-400 dark:text-zinc-500">
            No upcoming shows found near {zipCode}
          </p>
          <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-600">
            Try uploading more playlists or checking a different zip code.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            Upload more playlists
          </Link>
        </div>
      ) : view === "calendar" ? (
        <EventCalendar events={events} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
