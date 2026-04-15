export interface Song {
  title: string;
  artist: string;
  album: string;
  spotifyUrl: string;
  spotifyTrackId: string;
}

export interface Artist {
  name: string;
  songs: Song[];
}

export interface EventData {
  id: string;
  name: string;
  date: string;
  time: string;
  venue: string;
  venueAddress: string;
  city: string;
  state: string;
  ticketUrl: string;
  imageUrl: string;
  generalAdmission: boolean;
  priceRange: string | null;
  matchedArtists: Artist[];
}

export interface PlaylistData {
  artists: Artist[];
  uploadedAt: string;
}

export interface SearchConfig {
  zipCode: string;
  radius: number;
}
