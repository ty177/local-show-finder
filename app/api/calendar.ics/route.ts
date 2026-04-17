import { generateIcsFeed } from "@/lib/ics-generator";
import { findEventsForArtists } from "@/lib/ticketmaster";
import {
  getArtists,
  getEvents,
  setEvents,
  setZipCode,
  shouldRefresh,
  getZipCode,
  getUserIdByFeedToken,
} from "@/lib/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const zip = searchParams.get("zip");

  // Look up user by feed token
  if (!token) {
    return new Response(
      "Missing ?token= parameter. Use the URL from your calendar page.",
      { status: 400 }
    );
  }

  const userId = await getUserIdByFeedToken(token);
  if (!userId) {
    return new Response("Invalid or expired feed token.", { status: 403 });
  }

  const artists = await getArtists(userId);

  // If no artists, return valid empty calendar
  if (artists.length === 0) {
    const emptyIcs = generateIcsFeed([], zip || "00000");
    return new Response(emptyIcs, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  const userZip = zip || (await getZipCode(userId));
  if (!userZip) {
    const emptyIcs = generateIcsFeed([], "00000");
    return new Response(emptyIcs, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  let events = await getEvents(userId);
  const stale = await shouldRefresh(userId);

  // Refresh if stale
  if (stale || events.length === 0) {
    try {
      await setZipCode(userId, userZip);
      events = await findEventsForArtists(artists, userZip, 40);
      await setEvents(userId, events);
    } catch {
      // Fall back to cached events
      if (events.length === 0) {
        const emptyIcs = generateIcsFeed([], userZip);
        return new Response(emptyIcs, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      }
    }
  }

  const icsContent = generateIcsFeed(events, userZip);

  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
