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

function getBestImage(images: TicketmasterImage[]): string {
  if (!images || images.length === 0) return "";
  // Prefer 16:9 ratio, largest width
  const sorted = [...images].sort((a, b) => {
    const aScore = (a.ratio === "16_9" ? 1000 : 0) + (a.width || 0);
    const bScore = (b.ratio === "16_9" ? 1000 : 0) + (b.width || 0);
    return bScore - aScore;
  });
  return sorted[0].url;
}

function isOnSale(event: TicketmasterEvent): boolean {
  const now = new Date().toISOString();

  // Check event status
  if (event.dates?.status?.code === "cancelled" || event.dates?.status?.code === "postponed") {
    return false;
  }

  const publicSale = event.sales?.public;
  if (!publicSale) return true; // If no sales info, assume on sale

  if (publicSale.startTBD) return false;

  const start = publicSale.startDateTime;
  const end = publicSale.endDateTime;

  if (start && now < start) return false; // Not yet on sale
  if (end && now > end) return false; // Sale ended

  return true;
}

function isGeneralAdmission(event: TicketmasterEvent): boolean {
  // No seatmap usually means GA
  if (!event.seatmap) return true;

  // Check price ranges for GA indicators
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

function mapEvent(event: TicketmasterEvent, matchedArtists: Artist[]): EventData {
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

export async function searchEventsForArtist(
  artistName: string,
  zipCode: string,
  radius: number = 40
): Promise<TicketmasterEvent[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    throw new Error("TICKETMASTER_API_KEY environment variable is not set");
  }

  const now = new Date().toISOString().split(".")[0] + "Z";
  const params = new URLSearchParams({
    apikey: apiKey,
    keyword: artistName,
    postalCode: zipCode,
    radius: String(radius),
    unit: "miles",
    classificationName: "music",
    sort: "date,asc",
    startDateTime: now,
    size: "20",
  });

  const response = await fetch(`${BASE_URL}/events.json?${params}`);

  if (response.status === 429) {
    // Rate limited — wait and retry once
    await new Promise((r) => setTimeout(r, 1000));
    const retry = await fetch(`${BASE_URL}/events.json?${params}`);
    if (!retry.ok) return [];
    const data: TicketmasterResponse = await retry.json();
    return data._embedded?.events || [];
  }

  if (!response.ok) return [];

  const data: TicketmasterResponse = await response.json();
  return data._embedded?.events || [];
}

export async function findEventsForArtists(
  artists: Artist[],
  zipCode: string,
  radius: number = 40
): Promise<EventData[]> {
  const eventMap = new Map<string, EventData>();

  // Process in batches to respect rate limits (5 req/sec on free tier)
  const batchSize = 5;
  for (let i = 0; i < artists.length; i += batchSize) {
    const batch = artists.slice(i, i + batchSize);

    const results = await Promise.all(
      batch.map(async (artist) => {
        const events = await searchEventsForArtist(artist.name, zipCode, radius);
        return { artist, events };
      })
    );

    for (const { artist, events } of results) {
      for (const event of events) {
        // Only include future events with tickets on sale
        if (!isOnSale(event)) continue;

        const existing = eventMap.get(event.id);
        if (existing) {
          // Merge matched artists if this event matches multiple
          if (!existing.matchedArtists.some((a) => a.name.toLowerCase() === artist.name.toLowerCase())) {
            existing.matchedArtists.push(artist);
          }
        } else {
          eventMap.set(event.id, mapEvent(event, [artist]));
        }
      }
    }

    // Small delay between batches to avoid rate limits
    if (i + batchSize < artists.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Sort by date
  return Array.from(eventMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}
