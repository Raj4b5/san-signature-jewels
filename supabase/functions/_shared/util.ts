export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** Razorpay signs with HMAC-SHA256 and compares as lowercase hex. */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time string compare. A plain `===` on a signature leaks how
 * many leading bytes matched via timing, which is enough to forge one.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Money in, paise out. Razorpay rejects anything but an integer. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const PHONE_RE = /^[6-9]\d{9}$/;
const PIN_RE = /^[1-9]\d{5}$/;

export type Customer = {
  name: string;
  phone: string;
  email?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  notes?: string | null;
};

/** Returns an error string, or null when the customer block is usable. */
export function validateCustomer(c: Partial<Customer> | undefined): string | null {
  if (!c) return "Delivery details are missing.";
  if (!c.name || c.name.trim().length < 2) return "Please enter your full name.";

  const phone = String(c.phone ?? "").replace(/\D/g, "").slice(-10);
  if (!PHONE_RE.test(phone)) return "Please enter a valid 10-digit mobile number.";

  if (!c.address_line1 || c.address_line1.trim().length < 5) {
    return "Please enter your house / flat and street.";
  }
  if (!c.city || c.city.trim().length < 2) return "Please enter your city.";
  if (!c.state || c.state.trim().length < 2) return "Please select your state.";
  if (!PIN_RE.test(String(c.pincode ?? "").trim())) return "Please enter a valid 6-digit PIN code.";
  if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) return "That email address looks incorrect.";

  return null;
}
