import type { Artist, EventData } from "./types";

const BASE_URL = "https://app.ticketmaster.com/discovery/v2";

interface TicketmasterImage {
  url: string;
  width: number;
  height: number;
  ratio?: string;
}

interface TicketmasterEvent {
  id: string;
  name: string;
  url: string;
  dates: {
    start: {
      localDate: string;
      localTime?: string;
      dateTime?: string;
    };
    status?: {
      code: string;
    };
  };
  sales?: {
    public?: {
      startDateTime?: string;
      endDateTime?: string;
      startTBD?: boolean;
    };
  };
  priceRanges?: Array<{
    type: string;
    currency: string;
    min: number;
    max: number;
  }>;
  images?: TicketmasterImage[];
  _embedded?: {
    venues?: Array<{
      name: string;
      address?: { line1?: string };
      city?: { name: string };
      state?: { stateCode: string; name: string };
      postalCode?: string;
      location?: { longitude: string; latitude: string };
    }>;
    attractions?: Array<{
      name: string;
      id: string;
    }>;
  };
  seatmap?: { staticUrl: string };
}

interface TicketmasterResponse {
  _embedded?: {
    events: TicketmasterEvent[];
  };
  page?: {
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

function getApiKey(): string {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    throw new Error("TICKETMASTER_API_KEY environment variable is not set");
  }
  return apiKey;
}

function getBestImage(images: TicketmasterImage[]): string {
  if (!images || images.length === 0) return "";
  const sorted = [...images].sort((a, b) => {
    const aScore = (a.ratio === "16_9" ? 1000 : 0) + (a.width || 0);
    const bScore = (b.ratio === "16_9" ? 1000 : 0) + (b.width || 0);
    return bScore - aScore;
  });
  return sorted[0].url;
}

function isOnSale(event: TicketmasterEvent): boolean {
  const now = new Date().toISOString();

  if (
    event.dates?.status?.code === "cancelled" ||
    event.dates?.status?.code === "postponed"
  ) {
    return false;
  }

  const publicSale = event.sales?.public;
  if (!publicSale) return true;
  if (publicSale.startTBD) return false;

  const start = publicSale.startDateTime;
  const end = publicSale.endDateTime;

  if (start && now < start) return false;
  if (end && now > end) return false;

  return true;
}

function isGeneralAdmission(event: TicketmasterEvent): boolean {
  if (!event.seatmap) return true;
  if (event.priceRanges) {
    return event.priceRanges.some(
      (pr) =>
        pr.type?.toLowerCase().includes("general admission") ||
        pr.type?.toLowerCase().includes("standard")
    );
  }
  return false;
}

function formatPriceRange(event: TicketmasterEvent): string | null {
  if (!event.priceRanges || event.priceRanges.length === 0) return null;
  const range = event.priceRanges[0];
  if (range.min === range.max) {
    return `$${range.min.toFixed(2)}`;
  }
  return `$${range.min.toFixed(2)} - $${range.max.toFixed(2)}`;
}

function mapEvent(
  event: TicketmasterEvent,
  matchedArtists: Artist[]
): EventData {
  const venue = event._embedded?.venues?.[0];
  return {
    id: event.id,
    name: event.name,
    date: event.dates.start.localDate,
    time: event.dates.start.localTime || "",
    venue: venue?.name || "TBA",
    venueAddress: [
      venue?.address?.line1,
      venue?.city?.name,
      venue?.state?.stateCode,
      venue?.postalCode,
    ]
      .filter(Boolean)
      .join(", "),
    city: venue?.city?.name || "",
    state: venue?.state?.stateCode || "",
    ticketUrl: event.url,
    imageUrl: getBestImage(event.images || []),
    generalAdmission: isGeneralAdmission(event),
    priceRange: formatPriceRange(event),
    matchedArtists,
  };
}

// Build a set of normalized artist names for fast matching
function buildArtistIndex(artists: Artist[]): Map<string, Artist> {
  const index = new Map<string, Artist>();
  for (const artist of artists) {
    index.set(artist.name.toLowerCase().trim(), artist);
  }
  return index;
}

// Match a Ticketmaster event's attractions against the user's artists
function matchArtists(
  event: TicketmasterEvent,
  artistIndex: Map<string, Artist>
): Artist[] {
  const matched: Artist[] = [];
  const attractions = event._embedded?.attractions || [];

  for (const attraction of attractions) {
    const name = attraction.name.toLowerCase().trim();

    // Exact match first
    const artist = artistIndex.get(name);
    if (artist) {
      matched.push(artist);
      continue;
    }

    // Substring match only for names long enough to avoid false positives
    // (e.g. "LD" matching "RL Grime" would be wrong)
    for (const [key, a] of artistIndex) {
      if (key.length < 5) continue; // skip very short names for fuzzy
      if (
        (name.includes(key) || key.includes(name)) &&
        !matched.includes(a)
      ) {
        matched.push(a);
      }
    }
  }

  // Also check the event name for artist mentions (only longer names)
  if (matched.length === 0) {
    const eventNameLower = event.name.toLowerCase();
    for (const [key, a] of artistIndex) {
      if (key.length >= 6 && eventNameLower.includes(key)) {
        matched.push(a);
      }
    }
  }

  return matched;
}

// Convert zip code to lat/long using the Ticketmaster suggest API,
// which is more reliable than the postalCode param for geo search.
async function zipToLatLong(
  zipCode: string
): Promise<{ lat: string; lon: string } | null> {
  // Use a free geocoding approach: query Ticketmaster venues by postal code
  // and extract the lat/long from the first result
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    apikey: apiKey,
    postalCode: zipCode,
    countryCode: "US",
    size: "1",
  });

  const response = await fetch(`${BASE_URL}/venues.json?${params}`);
  if (!response.ok) return null;

  const data = await response.json();
  const venue = data?._embedded?.venues?.[0];
  if (!venue?.location) return null;

  return { lat: venue.location.latitude, lon: venue.location.longitude };
}

// US zip code centroid fallback (rough estimates for major areas)
function zipToApproxLatLong(zipCode: string): { lat: string; lon: string } {
  // Use the first 3 digits to get a rough region
  const prefix = zipCode.substring(0, 3);
  const regions: Record<string, { lat: string; lon: string }> = {
    "100": { lat: "40.7128", lon: "-74.0060" }, // NYC
    "101": { lat: "40.7128", lon: "-74.0060" },
    "900": { lat: "34.0522", lon: "-118.2437" }, // LA
    "606": { lat: "41.8781", lon: "-87.6298" }, // Chicago
    "770": { lat: "29.7604", lon: "-95.3698" }, // Houston
  };
  return regions[prefix] || { lat: "40.7128", lon: "-74.0060" };
}

// Fetch all music events near a zip code, paginating through results
async function fetchAllLocalEvents(
  zipCode: string,
  radius: number
): Promise<TicketmasterEvent[]> {
  const apiKey = getApiKey();
  const allEvents: TicketmasterEvent[] = [];
  const maxPages = 5; // 5 pages × 200 events = up to 1000 events

  // Resolve zip to lat/long for reliable geo search
  const coords =
    (await zipToLatLong(zipCode)) || zipToApproxLatLong(zipCode);

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      apikey: apiKey,
      latlong: `${coords.lat},${coords.lon}`,
      radius: String(radius),
      unit: "miles",
      classificationName: "music",
      sort: "date,asc",
      size: "200",
      page: String(page),
    });

    const response = await fetch(`${BASE_URL}/events.json?${params}`);

    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 1100));
      const retry = await fetch(`${BASE_URL}/events.json?${params}`);
      if (!retry.ok) break;
      const data: TicketmasterResponse = await retry.json();
      const events = data._embedded?.events || [];
      allEvents.push(...events);
      if (!data.page || page >= (data.page.totalPages || 1) - 1) break;
      continue;
    }

    if (!response.ok) break;

    const data: TicketmasterResponse = await response.json();
    const events = data._embedded?.events || [];
    allEvents.push(...events);

    // Stop if we've fetched all pages
    if (!data.page || page >= (data.page.totalPages || 1) - 1) break;

    // Small delay between pages
    await new Promise((r) => setTimeout(r, 200));
  }

  return allEvents;
}

export async function findEventsForArtists(
  artists: Artist[],
  zipCode: string,
  radius: number = 40
): Promise<EventData[]> {
  const artistIndex = buildArtistIndex(artists);

  // Fetch all music events near the zip code (fast: ~5 API calls max)
  const allLocalEvents = await fetchAllLocalEvents(zipCode, radius);

  const eventMap = new Map<string, EventData>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const event of allLocalEvents) {
    // Only future events with tickets on sale
    const eventDate = new Date(event.dates.start.localDate);
    if (eventDate < today) continue;
    if (!isOnSale(event)) continue;

    // Match against user's artists
    const matched = matchArtists(event, artistIndex);
    if (matched.length === 0) continue;

    const existing = eventMap.get(event.id);
    if (existing) {
      for (const a of matched) {
        if (
          !existing.matchedArtists.some(
            (ea) => ea.name.toLowerCase() === a.name.toLowerCase()
          )
        ) {
          existing.matchedArtists.push(a);
        }
      }
    } else {
      eventMap.set(event.id, mapEvent(event, matched));
    }
  }

  return Array.from(eventMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}
