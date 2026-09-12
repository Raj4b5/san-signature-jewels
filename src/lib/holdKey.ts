import * as Crypto from "expo-crypto";
import { storage } from "./storage";

const STORAGE_KEY = "ssj-hold-key-v1";

let cached: string | null = null;

/**
 * A random id for this device, sent with every checkout.
 *
 * When a shopper starts paying, their pieces are held for a few minutes
 * so nobody else can buy them. This key is how the server recognises the
 * same shopper coming back: a retry replaces their earlier hold instead
 * of being blocked by it, and backing out releases it early. It is never
 * displayed, which is what makes it safe to treat as proof of ownership.
 */
export async function getHoldKey(): Promise<string> {
  if (cached) return cached;

  try {
    const stored = await storage.getItem(STORAGE_KEY);
    if (stored && stored.length >= 16) {
      cached = stored;
      return stored;
    }
  } catch {
    // Storage unavailable: fall through to a key for this session.
  }

  const fresh = Crypto.randomUUID();
  cached = fresh;
  try {
    await storage.setItem(STORAGE_KEY, fresh);
  } catch {
    // A session-only key still works; it just won't survive a restart.
  }
  return fresh;
}
