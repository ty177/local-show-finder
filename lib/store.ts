import { kv } from "@vercel/kv";
import type { Artist, EventData } from "./types";

// When KV_REST_API_URL is set, use Vercel KV (Redis) for persistence.
// Otherwise fall back to in-memory store for local dev.

const useKv = !!process.env.KV_REST_API_URL;

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
  if (!useKv) return mem.artists;
  return (await kv.get<Artist[]>("artists")) || [];
}

export async function setArtists(artists: Artist[]): Promise<void> {
  if (!useKv) {
    mem.artists = artists;
    return;
  }
  await kv.set("artists", artists);
}

export async function getEvents(): Promise<EventData[]> {
  if (!useKv) return mem.events;
  return (await kv.get<EventData[]>("events")) || [];
}

export async function setEvents(events: EventData[]): Promise<void> {
  const now = Date.now();
  if (!useKv) {
    mem.events = events;
    mem.lastFetched = now;
    return;
  }
  await kv.set("events", events);
  await kv.set("lastFetched", now);
}

export async function getZipCode(): Promise<string> {
  if (!useKv) return mem.zipCode;
  return (await kv.get<string>("zipCode")) || "";
}

export async function setZipCode(zip: string): Promise<void> {
  if (!useKv) {
    mem.zipCode = zip;
    return;
  }
  await kv.set("zipCode", zip);
}

export async function getLastFetched(): Promise<number> {
  if (!useKv) return mem.lastFetched;
  return (await kv.get<number>("lastFetched")) || 0;
}

export async function shouldRefresh(): Promise<boolean> {
  const last = await getLastFetched();
  return Date.now() - last > 60 * 60 * 1000;
}
