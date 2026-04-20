import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  fetchUserPlaylists,
  fetchPlaylistTracks,
  fetchLikedSongs,
  tracksToArtists,
} from "@/lib/spotify";

// GET — list user's Spotify playlists
export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const playlists = await fetchUserPlaylists(session.accessToken);
    return NextResponse.json({ playlists });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

// POST — import tracks from selected playlists + optionally liked songs
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { playlistIds, includeLikedSongs } = body as {
      playlistIds?: string[];
      includeLikedSongs?: boolean;
    };

    if (
      (!playlistIds || playlistIds.length === 0) &&
      !includeLikedSongs
    ) {
      return NextResponse.json(
        { error: "Select at least one playlist or Liked Songs." },
        { status: 400 }
      );
    }

    // Fetch tracks from selected playlists in parallel
    const playlistResults = await Promise.all(
      (playlistIds || []).map(async (id) => {
        const result = await fetchPlaylistTracks(session.accessToken!, id);
        return { id, ...result };
      })
    );

    const allTracks = playlistResults.flatMap((r) => r.tracks);

    if (includeLikedSongs) {
      try {
        const liked = await fetchLikedSongs(session.accessToken);
        allTracks.push(...liked);
      } catch (err) {
        // If liked songs fail, include the error in the summary
        playlistResults.push({
          id: "liked",
          tracks: [],
          error: (err as Error).message,
        });
      }
    }

    const artists = tracksToArtists(allTracks);

    // Summarize per-playlist results for debugging
    const failed = playlistResults.filter((r) => r.error);

    return NextResponse.json({
      artists,
      artistCount: artists.length,
      songCount: artists.reduce((sum, a) => sum + a.songs.length, 0),
      trackCount: allTracks.length,
      playlistsFetched: playlistResults.length,
      failedPlaylists: failed.map((r) => ({ id: r.id, error: r.error })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
