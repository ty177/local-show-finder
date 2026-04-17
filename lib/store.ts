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

// ── In-memory fallback (keyed by userId) ────────────────────────────

interface UserData {
  artists: Artist[];
  events: EventData[];
  zipCode: string;
  lastFetched: number;
  feedToken: string;
}

const memStore = new Map<string, UserData>();

function getMemUser(userId: string): UserData {
  let data = memStore.get(userId);
  if (!data) {
    data = { artists: [], events: [], zipCode: "", lastFetched: 0, feedToken: "" };
    memStore.set(userId, data);
  }
  return data;
}

// ── Key helpers ─────────────────────────────────────────────────────

function key(userId: string, field: string): string {
  return `user:${userId}:${field}`;
}

// ── Public API (all async, scoped by userId) ────────────────────────

export async function getArtists(userId: string): Promise<Artist[]> {
  if (!redis) return getMemUser(userId).artists;
  return (await redis.get<Artist[]>(key(userId, "artists"))) || [];
}

export async function setArtists(userId: string, artists: Artist[]): Promise<void> {
  if (!redis) {
    getMemUser(userId).artists = artists;
    return;
  }
  await redis.set(key(userId, "artists"), JSON.stringify(artists));
}

export async function getEvents(userId: string): Promise<EventData[]> {
  if (!redis) return getMemUser(userId).events;
  return (await redis.get<EventData[]>(key(userId, "events"))) || [];
}

export async function setEvents(userId: string, events: EventData[]): Promise<void> {
  const now = Date.now();
  if (!redis) {
    const u = getMemUser(userId);
    u.events = events;
    u.lastFetched = now;
    return;
  }
  await redis.set(key(userId, "events"), JSON.stringify(events));
  await redis.set(key(userId, "lastFetched"), now);
}

export async function getZipCode(userId: string): Promise<string> {
  if (!redis) return getMemUser(userId).zipCode;
  return (await redis.get<string>(key(userId, "zipCode"))) || "";
}

export async function setZipCode(userId: string, zip: string): Promise<void> {
  if (!redis) {
    getMemUser(userId).zipCode = zip;
    return;
  }
  await redis.set(key(userId, "zipCode"), zip);
}

export async function getLastFetched(userId: string): Promise<number> {
  if (!redis) return getMemUser(userId).lastFetched;
  return (await redis.get<number>(key(userId, "lastFetched"))) || 0;
}

export async function shouldRefresh(userId: string): Promise<boolean> {
  const last = await getLastFetched(userId);
  return Date.now() - last > 60 * 60 * 1000;
}

// ── Feed token (for .ics subscriptions) ─────────────────────────────

export async function getFeedToken(userId: string): Promise<string> {
  if (!redis) return getMemUser(userId).feedToken;
  return (await redis.get<string>(key(userId, "feedToken"))) || "";
}

export async function setFeedToken(userId: string, token: string): Promise<void> {
  if (!redis) {
    getMemUser(userId).feedToken = token;
    return;
  }
  // Store both directions: userId → token and token → userId
  await redis.set(key(userId, "feedToken"), token);
  await redis.set(`feedToken:${token}`, userId);
}

export async function getUserIdByFeedToken(token: string): Promise<string | null> {
  if (!redis) {
    // Search in-memory
    for (const [uid, data] of memStore) {
      if (data.feedToken === token) return uid;
    }
    return null;
  }
  return (await redis.get<string>(`feedToken:${token}`)) || null;
}
