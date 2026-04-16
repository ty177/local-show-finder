import { NextResponse } from "next/server";
import { parseCsvContent, mergeArtists } from "@/lib/csv-parser";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
    }

    let allNewArtists: import("@/lib/types").Artist[] = [];

    for (const file of files) {
      const text = await file.text();
      try {
        const artists = parseCsvContent(text);
        allNewArtists = mergeArtists(allNewArtists, artists);
      } catch (err) {
        return NextResponse.json(
          { error: `Error parsing ${file.name}: ${(err as Error).message}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      artists: allNewArtists,
      artistCount: allNewArtists.length,
      songCount: allNewArtists.reduce((sum, a) => sum + a.songs.length, 0),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
