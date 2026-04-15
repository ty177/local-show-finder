"use client";

import Link from "next/link";
import type { EventData } from "@/lib/types";
import { format, parseISO } from "date-fns";

export default function EventCard({
  event,
  compact = false,
}: {
  event: EventData;
  compact?: boolean;
}) {
  const date = parseISO(event.date);
  const artistNames = event.matchedArtists.map((a) => a.name).join(", ");

  if (compact) {
    return (
      <Link
        href={`/event/${event.id}`}
        className="group block rounded-lg bg-emerald-50 p-1.5 text-xs transition-colors hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50"
      >
        <p className="truncate font-medium text-emerald-900 dark:text-emerald-200">
          {event.name}
        </p>
        {event.time && (
          <p className="text-emerald-600 dark:text-emerald-400">
            {format(new Date(`2000-01-01T${event.time}`), "h:mm a")}
          </p>
        )}
      </Link>
    );
  }

  return (
    <Link
      href={`/event/${event.id}`}
      className="group block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
    >
      {event.imageUrl && (
        <div className="relative h-40 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-700">
          <img
            src={event.imageUrl}
            alt={event.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
          {event.generalAdmission && (
            <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white shadow">
              GA
            </span>
          )}
        </div>
      )}
      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          {format(date, "EEE, MMM d")}
          {event.time &&
            ` · ${format(new Date(`2000-01-01T${event.time}`), "h:mm a")}`}
        </p>
        <h3 className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {event.name}
        </h3>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          {event.venue} · {event.city}
          {event.state ? `, ${event.state}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            From your playlists:
          </span>
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {artistNames}
          </span>
        </div>
        {event.priceRange && (
          <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {event.priceRange}
          </p>
        )}
      </div>
    </Link>
  );
}
