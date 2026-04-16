import { generateIcsFeed } from "@/lib/ics-generator";
import { findEventsForArtists } from "@/lib/ticketmaster";
import {
  getArtists,
  getEvents,
  setEvents,
  setZipCode,
  shouldRefresh,
  getZipCode,
} from "@/lib/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get("zip");

  if (!zip || !/^\d{5}$/.test(zip)) {
    return new Response("Valid 5-digit zip code required as ?zip= parameter", {
      status: 400,
    });
  }

  const artists = await getArtists();

  // If no artists in store, return an empty but valid calendar
  // (calendar apps need valid ical, not an error page)
  if (artists.length === 0) {
    const emptyIcs = generateIcsFeed([], zip);
    return new Response(emptyIcs, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  let events = await getEvents();
  const stale = await shouldRefresh();
  const currentZip = await getZipCode();

  // Refresh if stale or different zip
  if (stale || events.length === 0 || currentZip !== zip) {
    try {
      await setZipCode(zip);
      events = await findEventsForArtists(artists, zip, 40);
      await setEvents(events);
    } catch {
      // Fall back to cached events if available — if none, return empty cal
      if (events.length === 0) {
        const emptyIcs = generateIcsFeed([], zip);
        return new Response(emptyIcs, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      }
    }
  }

  const icsContent = generateIcsFeed(events, zip);

  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
