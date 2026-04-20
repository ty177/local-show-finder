import type { Artist, Song } from "./types";

const SPOTIFY_API = "https://api.spotify.com/v1";

export interface SpotifyPlaylist {
  id: string;
  name: string;
  trackCount: number;
  imageUrl: string;
  owner: string;
  ownerId: string;
  restricted: boolean; // true if likely unreadable by dev-mode apps (Spotify-owned)
}

interface SpotifyArtistRef {
  name: string;
}

interface SpotifyTrack {
  id: string;
  name: string;
  album: { name: string };
  artists: SpotifyArtistRef[];
}

interface SpotifyPagedResponse<T> {
  items: T[];
  next: string | null;
  total: number;
}

interface SpotifyPlaylistItem {
  track: SpotifyTrack | null;
}

interface SpotifySavedTrackItem {
  track: SpotifyTrack;
}

interface SpotifyPlaylistRaw {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
  owner: { display_name: string; id: string };
}

async function spotifyFetch<T>(
  accessToken: string,
  url: string
): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401) {
    throw new Error("Spotify access token expired. Please sign in again.");
  }
  if (res.status === 429) {
    throw new Error("Spotify rate limit. Try again in a moment.");
  }
  if (!res.ok) {
    throw new Error(`Spotify API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

async function fetchAllPages<T>(
  accessToken: string,
  firstUrl: string
): Promise<T[]> {
  const all: T[] = [];
  let url: string | null = firstUrl;

  while (url) {
    const page: SpotifyPagedResponse<T> = await spotifyFetch(accessToken, url);
    all.push(...page.items);
    url = page.next;
  }

  return all;
}

interface SpotifyMe {
  id: string;
  display_name?: string;
}

export async function fetchCurrentUser(
  accessToken: string
): Promise<SpotifyMe> {
  return spotifyFetch<SpotifyMe>(accessToken, `${SPOTIFY_API}/me`);
}

export async function fetchUserPlaylists(
  accessToken: string
): Promise<SpotifyPlaylist[]> {
  const [me, raw] = await Promise.all([
    fetchCurrentUser(accessToken),
    fetchAllPages<SpotifyPlaylistRaw>(
      accessToken,
      `${SPOTIFY_API}/me/playlists?limit=50`
    ),
  ]);

  const myId = me.id;

  return raw.map((p) => ({
    id: p.id,
    name: p.name,
    trackCount: p.tracks?.total || 0,
    imageUrl: p.images?.[0]?.url || "",
    owner: p.owner?.display_name || "",
    ownerId: p.owner?.id || "",
    // Spotify dev-mode apps can only reliably read playlists owned by
    // the authenticated user. Followed / Spotify-owned playlists may
    // return empty or 403.
    restricted: p.owner?.id !== myId,
  }));
}

export interface PlaylistFetchResult {
  tracks: SpotifyTrack[];
  error: string | null;
}

interface SpotifyPlaylistDetailResponse {
  tracks: {
    items: SpotifyPlaylistItem[];
    next: string | null;
    total: number;
  };
}

export async function fetchPlaylistTracks(
  accessToken: string,
  playlistId: string
): Promise<PlaylistFetchResult> {
  // Spotify's dev-mode apps currently return 403 on the
  // /playlists/{id}/tracks endpoint even for playlists the user owns.
  // The workaround: read from /playlists/{id} directly, which embeds
  // the first page of tracks, then paginate via tracks.next.
  try {
    const tracks: SpotifyTrack[] = [];

    const firstRes = await spotifyFetch<SpotifyPlaylistDetailResponse>(
      accessToken,
      `${SPOTIFY_API}/playlists/${playlistId}?fields=tracks.items(track(id,name,album(name),artists(name))),tracks.next,tracks.total`
    );

    const addItems = (items: SpotifyPlaylistItem[]) => {
      for (const it of items) {
        if (it?.track?.id) tracks.push(it.track);
      }
    };

    addItems(firstRes.tracks?.items || []);

    // Paginate through the rest via tracks.next (this endpoint does work
    // in dev mode, unlike the base /playlists/{id}/tracks call)
    let next = firstRes.tracks?.next;
    while (next) {
      const page = await spotifyFetch<SpotifyPagedResponse<SpotifyPlaylistItem>>(
        accessToken,
        next
      );
      addItems(page.items);
      next = page.next;
    }

    return { tracks, error: null };
  } catch (err) {
    return { tracks: [], error: (err as Error).message };
  }
}

export async function fetchLikedSongs(
  accessToken: string
): Promise<SpotifyTrack[]> {
  const items = await fetchAllPages<SpotifySavedTrackItem>(
    accessToken,
    `${SPOTIFY_API}/me/tracks?limit=50`
  );
  return items.map((i) => i.track).filter((t) => !!t?.id);
}

// Convert Spotify tracks into the Artist[] shape used by the rest of the app
export function tracksToArtists(tracks: SpotifyTrack[]): Artist[] {
  const artistMap = new Map<string, Song[]>();
  const displayNames = new Map<string, string>();

  for (const track of tracks) {
    if (!track?.name || !track?.artists?.length) continue;

    const rawArtistString = track.artists.map((a) => a.name).join(", ");
    const song: Song = {
      title: track.name,
      artist: rawArtistString,
      album: track.album?.name || "",
      spotifyUrl: `https://open.spotify.com/track/${track.id}`,
      spotifyTrackId: track.id,
    };

    for (const a of track.artists) {
      const name = a.name.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!displayNames.has(key)) displayNames.set(key, name);

      const songs = artistMap.get(key);
      if (songs) {
        if (
          !songs.some(
            (s) => s.title === song.title && s.artist === song.artist
          )
        ) {
          songs.push(song);
        }
      } else {
        artistMap.set(key, [song]);
      }
    }
  }

  const artists: Artist[] = [];
  for (const [key, songs] of artistMap) {
    artists.push({ name: displayNames.get(key) || key, songs });
  }
  return artists;
}
