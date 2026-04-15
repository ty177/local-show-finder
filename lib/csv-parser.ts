import Papa from "papaparse";
import type { Artist, Song } from "./types";

interface SpotifyCsvRow {
  [key: string]: string;
}

// Spotify CSV exports can have varying column names. We try common patterns.
function findColumn(headers: string[], candidates: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function extractSpotifyTrackId(url: string): string {
  // Handles both URLs like https://open.spotify.com/track/ABC123 and spotify:track:ABC123
  const urlMatch = url.match(/track\/([a-zA-Z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  const uriMatch = url.match(/track:([a-zA-Z0-9]+)/);
  if (uriMatch) return uriMatch[1];
  return "";
}

export function parseCsvContent(csvText: string): Artist[] {
  const result = Papa.parse<SpotifyCsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(`CSV parse error: ${result.errors[0].message}`);
  }

  const headers = result.meta.fields || [];
  const trackCol = findColumn(headers, [
    "Track Name",
    "track_name",
    "Song Name",
    "Title",
    "name",
    "Track",
  ]);
  const artistCol = findColumn(headers, [
    "Artist Name(s)",
    "Artist Name",
    "artist_name",
    "Artist",
    "artist",
    "Artists",
  ]);
  const albumCol = findColumn(headers, [
    "Album Name",
    "album_name",
    "Album",
    "album",
  ]);
  const urlCol = findColumn(headers, [
    "Track URI",
    "Spotify URI",
    "URI",
    "uri",
    "Track URL",
    "Spotify URL",
    "URL",
    "url",
    "Spotify ID",
    "Track ID",
  ]);

  if (!trackCol || !artistCol) {
    throw new Error(
      `Could not find required columns. Found: ${headers.join(", ")}. Need at least a track name and artist column.`
    );
  }

  const artistMap = new Map<string, Song[]>();

  for (const row of result.data) {
    const rawArtist = row[artistCol]?.trim();
    const track = row[trackCol]?.trim();
    if (!rawArtist || !track) continue;

    const spotifyRaw = urlCol ? (row[urlCol]?.trim() || "") : "";
    const trackId = extractSpotifyTrackId(spotifyRaw);
    const spotifyUrl = trackId
      ? `https://open.spotify.com/track/${trackId}`
      : "";

    // Some CSVs list multiple artists separated by commas or semicolons.
    // We attribute the song to each artist individually.
    const artistNames = rawArtist.split(/[,;]/).map((a) => a.trim()).filter(Boolean);

    const song: Song = {
      title: track,
      artist: rawArtist,
      album: albumCol ? (row[albumCol]?.trim() || "") : "",
      spotifyUrl,
      spotifyTrackId: trackId,
    };

    for (const name of artistNames) {
      const normalized = name.toLowerCase();
      const existing = artistMap.get(normalized);
      if (existing) {
        // Avoid duplicate songs
        if (!existing.some((s) => s.title === song.title && s.artist === song.artist)) {
          existing.push(song);
        }
      } else {
        artistMap.set(normalized, [{ ...song }]);
      }
    }
  }

  // Convert map to array, using the original casing from the first occurrence
  const artists: Artist[] = [];
  const seenNames = new Map<string, string>(); // normalized -> display name

  for (const row of result.data) {
    const rawArtist = row[artistCol]?.trim();
    if (!rawArtist) continue;
    const names = rawArtist.split(/[,;]/).map((a) => a.trim()).filter(Boolean);
    for (const name of names) {
      const normalized = name.toLowerCase();
      if (!seenNames.has(normalized)) {
        seenNames.set(normalized, name);
      }
    }
  }

  for (const [normalized, songs] of artistMap) {
    artists.push({
      name: seenNames.get(normalized) || normalized,
      songs,
    });
  }

  return artists;
}

export function mergeArtists(existing: Artist[], incoming: Artist[]): Artist[] {
  const map = new Map<string, Artist>();

  for (const artist of existing) {
    map.set(artist.name.toLowerCase(), { ...artist, songs: [...artist.songs] });
  }

  for (const artist of incoming) {
    const key = artist.name.toLowerCase();
    const current = map.get(key);
    if (current) {
      for (const song of artist.songs) {
        if (!current.songs.some((s) => s.title === song.title && s.artist === song.artist)) {
          current.songs.push(song);
        }
      }
    } else {
      map.set(key, { ...artist, songs: [...artist.songs] });
    }
  }

  return Array.from(map.values());
}
