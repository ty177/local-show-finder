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
  };
}

interface AttractionResponse {
  _embedded?: {
    attractions: Array<{
      id: string;
      name: string;
    }>;
  };
}

function getApiKey(): string {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    throw new Error("TICKETMASTER_API_KEY environment variable is not set");
  }
  return apiKey;
}

async function fetchWithRetry(url: string): Promise<Response | null> {
  const response = await fetch(url);

  if (response.status === 429) {
    await new Promise((r) => setTimeout(r, 1100));
    const retry = await fetch(url);
    if (!retry.ok) return null;
    return retry;
  }

  if (!response.ok) return null;
  return response;
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
    matchedArtists: matchedArtists,
  };
}

// Step 1: Resolve artist name → Ticketmaster attractionId
async function resolveAttractionId(
  artistName: string
): Promise<string | null> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    apikey: apiKey,
    keyword: artistName,
    classificationName: "music",
    size: "1",
  });

  const response = await fetchWithRetry(
    `${BASE_URL}/attractions.json?${params}`
  );
  if (!response) return null;

  const data: AttractionResponse = await response.json();
  const attraction = data._embedded?.attractions?.[0];
  if (!attraction) return null;

  // Verify the name is a reasonable match (avoid false positives)
  const queryLower = artistName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const resultLower = attraction.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (
    !resultLower.includes(queryLower) &&
    !queryLower.includes(resultLower)
  ) {
    return null;
  }

  return attraction.id;
}

// Step 2: Search events by attractionId near a zip code
async function searchEventsByAttraction(
  attractionId: string,
  zipCode: string,
  radius: number
): Promise<TicketmasterEvent[]> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    apikey: apiKey,
    attractionId,
    postalCode: zipCode,
    radius: String(radius),
    unit: "miles",
    classificationName: "music",
    sort: "date,asc",
    size: "20",
  });

  const response = await fetchWithRetry(`${BASE_URL}/events.json?${params}`);
  if (!response) return [];

  const data: TicketmasterResponse = await response.json();
  return data._embedded?.events || [];
}

// Fallback: keyword-based event search (catches cases where attraction
// lookup fails but keyword matches on the event name)
async function searchEventsByKeyword(
  artistName: string,
  zipCode: string,
  radius: number
): Promise<TicketmasterEvent[]> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    apikey: apiKey,
    keyword: artistName,
    postalCode: zipCode,
    radius: String(radius),
    unit: "miles",
    classificationName: "music",
    sort: "date,asc",
    size: "20",
  });

  const response = await fetchWithRetry(`${BASE_URL}/events.json?${params}`);
  if (!response) return [];

  const data: TicketmasterResponse = await response.json();
  return data._embedded?.events || [];
}

export async function searchEventsForArtist(
  artistName: string,
  zipCode: string,
  radius: number = 40
): Promise<TicketmasterEvent[]> {
  // Try attraction-based search first (more accurate)
  const attractionId = await resolveAttractionId(artistName);
  if (attractionId) {
    const events = await searchEventsByAttraction(
      attractionId,
      zipCode,
      radius
    );
    if (events.length > 0) return events;
  }

  // Fallback to keyword search
  return searchEventsByKeyword(artistName, zipCode, radius);
}

export async function findEventsForArtists(
  artists: Artist[],
  zipCode: string,
  radius: number = 40
): Promise<EventData[]> {
  const eventMap = new Map<string, EventData>();

  // Process in batches of 3 (each artist makes up to 3 API calls:
  // attraction lookup + event search + possible keyword fallback)
  const batchSize = 3;
  for (let i = 0; i < artists.length; i += batchSize) {
    const batch = artists.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (artist) => {
        const events = await searchEventsForArtist(
          artist.name,
          zipCode,
          radius
        );
        return { artist, events };
      })
    );

    for (const { artist, events } of results) {
      for (const event of events) {
        if (!isOnSale(event)) continue;

        // Only include future events
        const eventDate = new Date(event.dates.start.localDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (eventDate < today) continue;

        const existing = eventMap.get(event.id);
        if (existing) {
          if (
            !existing.matchedArtists.some(
              (a) => a.name.toLowerCase() === artist.name.toLowerCase()
            )
          ) {
            existing.matchedArtists.push(artist);
          }
        } else {
          eventMap.set(event.id, mapEvent(event, [artist]));
        }
      }
    }

    // Delay between batches to stay within rate limits
    if (i + batchSize < artists.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return Array.from(eventMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}
