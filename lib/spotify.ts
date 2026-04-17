import type { Artist, Song } from "./types";

const SPOTIFY_API = "https://api.spotify.com/v1";

export interface SpotifyPlaylist {
  id: string;
  name: string;
  trackCount: number;
  imageUrl: string;
  owner: string;
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
  owner: { display_name: string };
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

export async function fetchUserPlaylists(
  accessToken: string
): Promise<SpotifyPlaylist[]> {
  const raw = await fetchAllPages<SpotifyPlaylistRaw>(
    accessToken,
    `${SPOTIFY_API}/me/playlists?limit=50`
  );

  return raw.map((p) => ({
    id: p.id,
    name: p.name,
    trackCount: p.tracks?.total || 0,
    imageUrl: p.images?.[0]?.url || "",
    owner: p.owner?.display_name || "",
  }));
}

export async function fetchPlaylistTracks(
  accessToken: string,
  playlistId: string
): Promise<SpotifyTrack[]> {
  const items = await fetchAllPages<SpotifyPlaylistItem>(
    accessToken,
    `${SPOTIFY_API}/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,album(name),artists(name))),next,total`
  );
  return items
    .map((i) => i.track)
    .filter((t): t is SpotifyTrack => t !== null && !!t.id);
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
