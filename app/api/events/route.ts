import { NextResponse } from "next/server";
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
  const forceRefresh = searchParams.get("refresh") === "true";

  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json(
      { error: "Valid 5-digit zip code required" },
      { status: 400 }
    );
  }

  const artists = await getArtists();
  if (artists.length === 0) {
    return NextResponse.json(
      { error: "No artists loaded. Upload playlist CSVs first." },
      { status: 400 }
    );
  }

  // Return cached events if fresh and same zip
  const cachedEvents = await getEvents();
  const stale = await shouldRefresh();
  const currentZip = await getZipCode();
  if (
    !forceRefresh &&
    !stale &&
    cachedEvents.length > 0 &&
    currentZip === zip
  ) {
    return NextResponse.json({
      events: cachedEvents,
      cached: true,
      artistCount: artists.length,
    });
  }

  try {
    await setZipCode(zip);
    const events = await findEventsForArtists(artists, zip, 40);
    await setEvents(events);

    return NextResponse.json({
      events,
      cached: false,
      artistCount: artists.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
