// =====================================================================
// place-order
//
// The only path that creates an order. Runs with the service role so it
// can read real prices out of the database -- the client sends product
// ids and quantities only, never money. Anything the browser claims a
// product costs is ignored.
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
};

const MAX_LINES = 40;
const MAX_QTY_PER_LINE = 20;

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

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  // ---- price the order from the database ------------------------------
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, code, name, price, stock, is_active, images")
    .in("id", [...wanted.keys()]);

  if (productsError) return fail("Could not load your items. Please try again.", 500);
  if (!products || products.length !== wanted.size) {
    return fail("One of the pieces in your bag is no longer available.", 409);
  }

  let subtotal = 0;
  const orderItems: Record<string, unknown>[] = [];

  for (const product of products) {
    const qty = wanted.get(product.id)!;

    if (!product.is_active) {
      return fail(`"${product.name}" is no longer available.`, 409);
    }
    if (product.stock < qty) {
      return fail(
        product.stock === 0
          ? `"${product.name}" has just sold out.`
          : `Only ${product.stock} left of "${product.name}".`,
        409,
      );
    }

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

  // ---- reserve an order number ----------------------------------------
  const { data: orderNumber, error: numberError } = await supabase.rpc("next_order_number");
  if (numberError || !orderNumber) return fail("Could not create your order. Please try again.", 500);

  // ---- open the Razorpay order before we write ours -------------------
  // If Razorpay is down we want to fail cleanly rather than leave a
  // stranded pending order in the table.
  let razorpayOrderId: string | null = null;
  let razorpayKeyId: string | null = null;

  if (payment_method === "razorpay") {
    const keyId = requireEnv("RAZORPAY_KEY_ID");
    const keySecret = requireEnv("RAZORPAY_KEY_SECRET");
    razorpayKeyId = keyId;

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: toPaise(total),
        currency: "INR",
        receipt: orderNumber,
        notes: {
          order_number: orderNumber,
          customer_name: customer!.name,
          customer_phone: customer!.phone,
        },
      }),
    });

    if (!response.ok) {
      console.error("razorpay order create failed", response.status, await response.text());
      return fail("Could not start the payment. Please try again in a moment.", 502);
    }

    const created = await response.json();
    razorpayOrderId = created.id;
  }

  // ---- write the order -------------------------------------------------
  const phone = String(customer!.phone).replace(/\D/g, "").slice(-10);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
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
      payment_method,
      payment_status: "pending",
      razorpay_order_id: razorpayOrderId,
      notes: customer!.notes?.trim() || null,
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    console.error("order insert failed", orderError);
    return fail("Could not save your order. Please try again.", 500);
  }

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

  if (itemsError) {
    // Don't leave a headless order behind.
    await supabase.from("orders").delete().eq("id", order.id);
    console.error("order items insert failed", itemsError);
    return fail("Could not save your order. Please try again.", 500);
  }

  // Cash on delivery is confirmed immediately, so hold the stock now.
  if (payment_method === "cod") {
    await supabase.rpc("reserve_stock_for_order", { p_order_id: order.id });
  }

  return json({
    order_number: order.order_number,
    subtotal,
    delivery_charge: deliveryCharge,
    total,
    payment_method,
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
