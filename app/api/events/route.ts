import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findEventsForArtists } from "@/lib/ticketmaster";
import { setArtists, setEvents, setZipCode, getFeedToken, setFeedToken } from "@/lib/store";
import type { Artist } from "@/lib/types";
import crypto from "crypto";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await request.json();
    const { zip, artists } = body as { zip?: string; artists?: Artist[] };

    if (!zip || !/^\d{5}$/.test(zip)) {
      return NextResponse.json(
        { error: "Valid 5-digit zip code required" },
        { status: 400 }
      );
    }

    if (!artists || artists.length === 0) {
      return NextResponse.json(
        { error: "No artists provided. Upload playlist CSVs first." },
        { status: 400 }
      );
    }

    const events = await findEventsForArtists(artists, zip, 40);

    // Persist to server-side store (scoped by user)
    await setArtists(userId, artists);
    await setEvents(userId, events);
    await setZipCode(userId, zip);

    // Generate feed token if user doesn't have one yet
    let feedToken = await getFeedToken(userId);
    if (!feedToken) {
      feedToken = crypto.randomBytes(24).toString("hex");
      await setFeedToken(userId, feedToken);
    }

    return NextResponse.json({
      events,
      artistCount: artists.length,
      feedToken,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
