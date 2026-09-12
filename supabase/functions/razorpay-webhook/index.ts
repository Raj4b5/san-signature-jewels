// =====================================================================
// razorpay-webhook
//
// The authoritative record of what was actually paid. Fires even when
// the customer closes the app mid-payment, and Razorpay retries it, so
// everything here must be safe to run repeatedly.
//
// Deploy with --no-verify-jwt: Razorpay calls this, not a signed-in user.
//   supabase functions deploy razorpay-webhook --no-verify-jwt
// =====================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import { hmacSha256Hex, timingSafeEqual, requireEnv } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  // The signature covers the exact bytes sent, so verify before parsing.
  const raw = await req.text();
  const expected = await hmacSha256Hex(requireEnv("RAZORPAY_WEBHOOK_SECRET"), raw);

  if (!timingSafeEqual(expected, signature)) {
    console.warn("webhook signature rejected");
    return new Response("Invalid signature", { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Malformed payload", { status: 400 });
  }

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const payment = event?.payload?.payment?.entity;

  switch (event?.event) {
    case "payment.captured":
    case "order.paid": {
      const orderId = payment?.order_id ?? event?.payload?.order?.entity?.id;
      const paymentId = payment?.id ?? null;
      if (!orderId) break;

      const { error } = await supabase.rpc("mark_order_paid", {
        p_razorpay_order_id: orderId,
        p_razorpay_payment_id: paymentId,
      });
      if (error) {
        console.error("mark_order_paid failed", error);
        // 500 asks Razorpay to retry, which is what we want here.
        return new Response("Could not settle order", { status: 500 });
      }
      break;
    }

    case "payment.failed": {
      const orderId = payment?.order_id;
      if (!orderId) break;
      await supabase.rpc("mark_order_failed", { p_razorpay_order_id: orderId });
      break;
    }

    default:
      // Everything else is acknowledged and ignored.
      break;
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
