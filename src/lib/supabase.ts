import "react-native-url-polyfill/auto";
import { storage, isPrerendering } from "./storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Whether the app has real credentials. A missing .env is the single
 * most likely first-run problem, so rather than throwing at import time
 * (which shows a red screen with a stack trace) the app renders a setup
 * screen explaining exactly what to do.
 */
export const isConfigured =
  !!url && !!anonKey && !url.includes("YOUR-PROJECT") && !anonKey.includes("YOUR-ANON");

export const SUPABASE_URL = url ?? "";
export const SUPABASE_ANON_KEY = anonKey ?? "";

export const supabase = createClient(
  isConfigured ? url! : "https://placeholder.supabase.co",
  isConfigured ? anonKey! : "placeholder-anon-key",
  {
    auth: {
      // Only the shop owner ever signs in; shoppers stay anonymous.
      storage,
      autoRefreshToken: isConfigured && !isPrerendering,
      persistSession: isConfigured,
      // Only a real browser has a URL to read a session back out of --
      // not native, and not the pre-render pass.
      detectSessionInUrl: Platform.OS === "web" && !isPrerendering,
    },
  },
);

/**
 * Calls a Supabase Edge Function and unwraps its error shape.
 * `supabase.functions.invoke` swallows the JSON body on non-2xx, which
 * hides the human-readable message the functions deliberately return.
 */
export async function callFunction<T>(
  name: string,
  payload: unknown,
  accessToken?: string,
): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken ?? SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    // fall through to the status-based message below
  }

  if (!response.ok) {
    throw new Error(body?.error ?? `Request failed (${response.status}). Please try again.`);
  }
  return body as T;
}
