import { Redis } from "@upstash/redis";
import type { Artist, EventData } from "./types";

// When UPSTASH_REDIS_REST_URL is set, use Upstash Redis for persistence.
// Otherwise fall back to in-memory store for local dev.

const useRedis =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = useRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// ── In-memory fallback ──────────────────────────────────────────────

interface MemStore {
  artists: Artist[];
  events: EventData[];
  zipCode: string;
  lastFetched: number;
}

const mem: MemStore = {
  artists: [],
  events: [],
  zipCode: "",
  lastFetched: 0,
};

// ── Public API (all async) ──────────────────────────────────────────

export async function getArtists(): Promise<Artist[]> {
  if (!redis) return mem.artists;
  return (await redis.get<Artist[]>("artists")) || [];
}

export async function setArtists(artists: Artist[]): Promise<void> {
  if (!redis) {
    mem.artists = artists;
    return;
  }
  await redis.set("artists", JSON.stringify(artists));
}

export async function getEvents(): Promise<EventData[]> {
  if (!redis) return mem.events;
  return (await redis.get<EventData[]>("events")) || [];
}

export async function setEvents(events: EventData[]): Promise<void> {
  const now = Date.now();
  if (!redis) {
    mem.events = events;
    mem.lastFetched = now;
    return;
  }
  await redis.set("events", JSON.stringify(events));
  await redis.set("lastFetched", now);
}

export async function getZipCode(): Promise<string> {
  if (!redis) return mem.zipCode;
  return (await redis.get<string>("zipCode")) || "";
}

export async function setZipCode(zip: string): Promise<void> {
  if (!redis) {
    mem.zipCode = zip;
    return;
  }
  await redis.set("zipCode", zip);
}

export async function getLastFetched(): Promise<number> {
  if (!redis) return mem.lastFetched;
  return (await redis.get<number>("lastFetched")) || 0;
}

export async function shouldRefresh(): Promise<boolean> {
  const last = await getLastFetched();
  return Date.now() - last > 60 * 60 * 1000;
}
