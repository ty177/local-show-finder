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
  if (artists.length === 0) {
    return new Response("No artists loaded. Upload playlist CSVs first.", {
      status: 400,
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
      // Fall back to cached events if available
      if (events.length === 0) {
        return new Response("Failed to fetch events", { status: 500 });
      }
    }
  }

  const icsContent = generateIcsFeed(events, zip);

  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="local-shows.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
