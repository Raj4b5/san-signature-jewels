// =====================================================================
// place-order
//
// The only path that creates an order. Runs with the service role so it
// can read real prices out of the database -- the client sends product
// ids and quantities only, never money. Anything the browser claims a
// product costs is ignored.
//
// Securing the pieces happens in create_order_with_hold (migration
// 0004): availability is checked and the pieces held -- or, for cash on
// delivery, taken -- in one locked transaction, so two shoppers can
// never both get the last one.
// =====================================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  corsHeaders,
  json,
  fail,
  toPaise,
  requireEnv,
  validateCustomer,
  type Customer,
} from "../_shared/util.ts";

type CartLine = { product_id: string; quantity: number };

type PlaceOrderBody = {
  items?: CartLine[];
  customer?: Partial<Customer>;
  payment_method?: "razorpay" | "cod";
  hold_key?: string;
};

type HoldResult =
  | { ok: true; order_id: string; order_number: string; hold_seconds: number | null }
  | {
      ok: false;
      reason: "unavailable" | "sold_out" | "held" | "bad_method" | "bad_hold_key" | "empty";
      product_id?: string;
      product_name?: string | null;
      stock?: number;
      available?: number;
      release_in_seconds?: number;
    };

const MAX_LINES = 40;
const MAX_QTY_PER_LINE = 20;

/** How long an online checkout keeps its pieces off the shelf. */
const HOLD_SECONDS = 15 * 60;
const HOLD_KEY_RE = /^[A-Za-z0-9-]{16,128}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed.", 405);

  let body: PlaceOrderBody;
  try {
    body = await req.json();
  } catch {
    return fail("Malformed request.");
  }

  const { items, customer, payment_method } = body;

  // ---- validate shape -------------------------------------------------
  if (!Array.isArray(items) || items.length === 0) return fail("Your bag is empty.");
  if (items.length > MAX_LINES) return fail("Too many items in one order.");
  if (payment_method !== "razorpay" && payment_method !== "cod") {
    return fail("Choose a payment method.");
  }

  const customerError = validateCustomer(customer);
  if (customerError) return fail(customerError);

  // Collapse duplicate lines so the same product twice cannot bypass
  // the per-line quantity cap.
  const wanted = new Map<string, number>();
  for (const line of items) {
    const qty = Math.floor(Number(line?.quantity));
    if (!line?.product_id || !Number.isFinite(qty) || qty < 1) return fail("Invalid item quantity.");
    wanted.set(line.product_id, (wanted.get(line.product_id) ?? 0) + qty);
  }
  for (const qty of wanted.values()) {
    if (qty > MAX_QTY_PER_LINE) return fail("That quantity is too large for a single piece.");
  }

  // An app that predates holds sends no key. It still gets a hold -- just
  // one it cannot release early, so it runs out on its own.
  const holdKey =
    typeof body.hold_key === "string" && HOLD_KEY_RE.test(body.hold_key)
      ? body.hold_key
      : crypto.randomUUID();

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  // ---- price the order from the database ------------------------------
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, code, name, price, images")
    .in("id", [...wanted.keys()]);

  if (productsError) return fail("Could not load your items. Please try again.", 500);
  if (!products || products.length !== wanted.size) {
    return fail("One of the pieces in your bag is no longer available.", 409);
  }

  const names = new Map(products.map((p) => [p.id, p.name as string]));
  let subtotal = 0;
  const orderItems: Record<string, unknown>[] = [];

  for (const product of products) {
    const qty = wanted.get(product.id)!;
    const unitPrice = Number(product.price);
    const lineTotal = Math.round(unitPrice * qty * 100) / 100;
    subtotal += lineTotal;

    orderItems.push({
      product_id: product.id,
      product_name: product.name,
      product_code: product.code,
      product_image: product.images?.[0] ?? null,
      unit_price: unitPrice,
      quantity: qty,
      line_total: lineTotal,
    });
  }
  subtotal = Math.round(subtotal * 100) / 100;

  // ---- delivery + payment rules ---------------------------------------
  const { data: settings } = await supabase
    .from("settings")
    .select("delivery_charge, free_delivery_above, cod_enabled, online_payment_enabled, store_name")
    .eq("id", 1)
    .single();

  if (payment_method === "cod" && settings && !settings.cod_enabled) {
    return fail("Cash on delivery is currently unavailable.", 409);
  }
  if (payment_method === "razorpay" && settings && !settings.online_payment_enabled) {
    return fail("Online payment is temporarily unavailable.", 409);
  }

  const baseDelivery = Number(settings?.delivery_charge ?? 0);
  const freeAbove = Number(settings?.free_delivery_above ?? 0);
  const deliveryCharge = freeAbove > 0 && subtotal >= freeAbove ? 0 : baseDelivery;
  const total = Math.round((subtotal + deliveryCharge) * 100) / 100;

  if (total <= 0) return fail("Order total must be greater than zero.");

  const phone = String(customer!.phone).replace(/\D/g, "").slice(-10);

  // ---- create the order and secure the pieces, atomically -------------
  const { data: held, error: holdError } = await supabase.rpc("create_order_with_hold", {
    p_order: {
      customer_name: customer!.name!.trim(),
      customer_phone: phone,
      customer_email: customer!.email?.trim() || null,
      address_line1: customer!.address_line1!.trim(),
      address_line2: customer!.address_line2?.trim() || null,
      city: customer!.city!.trim(),
      state: customer!.state!.trim(),
      pincode: String(customer!.pincode).trim(),
      subtotal,
      delivery_charge: deliveryCharge,
      total,
      notes: customer!.notes?.trim() || null,
    },
    p_items: orderItems,
    p_method: payment_method,
    p_hold_key: holdKey,
    p_hold_seconds: HOLD_SECONDS,
  });

  if (holdError || !held) {
    console.error("create_order_with_hold failed", holdError);
    return fail("Could not save your order. Please try again.", 500);
  }

  const result = held as HoldResult;
  if (!result.ok) {
    const name =
      result.product_name ?? (result.product_id ? names.get(result.product_id) : null) ?? "A piece";
    return json({ error: unavailableMessage(result, name), code: result.reason }, 409);
  }

  // ---- online: open the Razorpay order --------------------------------
  let razorpayOrderId: string | null = null;
  let razorpayKeyId: string | null = null;

  if (payment_method === "razorpay") {
    const keyId = requireEnv("RAZORPAY_KEY_ID");
    const keySecret = requireEnv("RAZORPAY_KEY_SECRET");
    razorpayKeyId = keyId;

    // Our order exists and holds its pieces. If Razorpay cannot take it,
    // delete it -- the cascade removes the items and frees the hold.
    const abandon = async (message: string, status: number) => {
      await supabase.from("orders").delete().eq("id", result.order_id);
      return fail(message, status);
    };

    let response: Response;
    try {
      response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: toPaise(total),
          currency: "INR",
          receipt: result.order_number,
          notes: {
            order_number: result.order_number,
            customer_name: customer!.name,
            customer_phone: phone,
          },
        }),
      });
    } catch (e) {
      console.error("razorpay unreachable", e);
      return abandon("Could not start the payment. Please try again in a moment.", 502);
    }

    if (!response.ok) {
      console.error("razorpay order create failed", response.status, await response.text());
      return abandon("Could not start the payment. Please try again in a moment.", 502);
    }

    const created = await response.json();
    razorpayOrderId = created.id;

    // Without this link, the webhook could never find the order, and a
    // captured payment would go unrecorded. Refuse rather than risk it.
    const { error: linkError } = await supabase
      .from("orders")
      .update({ razorpay_order_id: razorpayOrderId })
      .eq("id", result.order_id);

    if (linkError) {
      console.error("could not link razorpay order", linkError);
      return abandon("Could not start the payment. Please try again.", 500);
    }
  }

  return json({
    order_number: result.order_number,
    subtotal,
    delivery_charge: deliveryCharge,
    total,
    payment_method,
    hold_seconds: result.hold_seconds,
    razorpay: razorpayOrderId
      ? {
          order_id: razorpayOrderId,
          key_id: razorpayKeyId,
          amount: toPaise(total),
          currency: "INR",
          name: settings?.store_name ?? "San Signature Jewels",
          prefill: {
            name: customer!.name,
            contact: phone,
            email: customer!.email ?? "",
          },
        }
      : null,
  });
});

/** Tell the shopper plainly why a piece cannot be bought right now. */
function unavailableMessage(result: Extract<HoldResult, { ok: false }>, name: string): string {
  switch (result.reason) {
    case "sold_out":
      return result.stock && result.stock > 0
        ? `Only ${result.stock} left of "${name}".`
        : `"${name}" has just sold out.`;

    case "held": {
      if (result.available && result.available > 0) {
        return `Only ${result.available} of "${name}" can be bought right now. Another shopper is completing their purchase.`;
      }
      const minutes = Math.max(1, Math.ceil((result.release_in_seconds ?? 0) / 60));
      return `Someone is completing their purchase of "${name}" right now. If they don't finish, it will be available again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
    }

    case "unavailable":
      return `"${name}" is no longer available.`;

    default:
      return "Could not place your order. Please try again.";
  }
}
