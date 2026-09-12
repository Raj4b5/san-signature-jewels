// =====================================================================
// verify-payment
//
// Called by the app the instant Razorpay Checkout hands back a result,
// so the customer sees a confirmed order without waiting on a webhook.
// The webhook is still the safety net -- both call the same idempotent
// mark_order_paid(), so whichever arrives first wins and the second is
// a no-op.
// =====================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  corsHeaders,
  json,
  fail,
  hmacSha256Hex,
  timingSafeEqual,
  requireEnv,
} from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed.", 405);

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return fail("Malformed request.");
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return fail("Incomplete payment response.");
  }

  // Razorpay signs "<order_id>|<payment_id>" with the API key secret.
  const expected = await hmacSha256Hex(
    requireEnv("RAZORPAY_KEY_SECRET"),
    `${razorpay_order_id}|${razorpay_payment_id}`,
  );

  if (!timingSafeEqual(expected, razorpay_signature)) {
    // Change nothing. This endpoint is unauthenticated, so a bad
    // signature proves only that the caller is not Razorpay -- it must
    // not be able to mark someone else's pending order as failed. The
    // webhook remains the authority on what actually happened.
    console.warn("signature mismatch for order", razorpay_order_id);
    return fail("We could not verify this payment. If money was debited it will be refunded.", 400);
  }

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase.rpc("mark_order_paid", {
    p_razorpay_order_id: razorpay_order_id,
    p_razorpay_payment_id: razorpay_payment_id,
  });

  if (error) {
    console.error("mark_order_paid failed", error);
    return fail("Payment received, but we could not update your order. Please contact us.", 500);
  }

  return json(data);
});
