import { NextResponse } from "next/server";
import { findEventsForArtists } from "@/lib/ticketmaster";
import type { Artist } from "@/lib/types";

export async function POST(request: Request) {
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

    return NextResponse.json({
      events,
      artistCount: artists.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
