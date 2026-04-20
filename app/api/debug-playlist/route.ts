import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Temporary debug endpoint — inspect exactly what Spotify says
// about a given playlist and the current user.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get("id");
  if (!playlistId) {
    return NextResponse.json({ error: "?id= required" }, { status: 400 });
  }

  const headers = { Authorization: `Bearer ${session.accessToken}` };

  // 1. Who am I?
  const meRes = await fetch("https://api.spotify.com/v1/me", { headers });
  const me = meRes.ok ? await meRes.json() : { error: await meRes.text() };

  // 2. Playlist metadata
  const plRes = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}`,
    { headers }
  );
  const pl = plRes.ok ? await plRes.json() : { error: await plRes.text() };

  // 3. Direct call to tracks (first page only)
  const trRes = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=5`,
    { headers }
  );
  const tr = trRes.ok ? await trRes.json() : { error: await trRes.text() };

  return NextResponse.json({
    authenticatedAs: {
      id: me?.id,
      display_name: me?.display_name,
      email: me?.email,
    },
    playlistMeta: {
      id: pl?.id,
      name: pl?.name,
      owner: pl?.owner,
      total_tracks_per_api: pl?.tracks?.total,
      public: pl?.public,
      collaborative: pl?.collaborative,
      snapshot_id: pl?.snapshot_id,
      error: pl?.error,
    },
    tracksEndpoint: {
      status: trRes.status,
      total: tr?.total,
      itemsLength: Array.isArray(tr?.items) ? tr.items.length : null,
      firstItem: tr?.items?.[0]
        ? {
            added_at: tr.items[0].added_at,
            is_local: tr.items[0].is_local,
            trackName: tr.items[0].track?.name,
            trackId: tr.items[0].track?.id,
          }
        : null,
      error: tr?.error,
    },
  });
}
