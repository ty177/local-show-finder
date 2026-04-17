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
    const trackPromises: Promise<Awaited<ReturnType<typeof fetchPlaylistTracks>>>[] =
      (playlistIds || []).map((id) =>
        fetchPlaylistTracks(session.accessToken!, id)
      );
    if (includeLikedSongs) {
      trackPromises.push(fetchLikedSongs(session.accessToken));
    }

    const trackLists = await Promise.all(trackPromises);
    const allTracks = trackLists.flat();

    const artists = tracksToArtists(allTracks);

    return NextResponse.json({
      artists,
      artistCount: artists.length,
      songCount: artists.reduce((sum, a) => sum + a.songs.length, 0),
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
