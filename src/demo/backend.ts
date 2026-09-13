import { createDemoState, OWNER_ID, type DemoState } from "./catalogue";

/**
 * A pretend Supabase that lives inside the app, for demos.
 *
 * It answers the same HTTP requests supabase-js makes to a real project --
 * PostgREST queries, RPCs, sign-in, and the place-order function -- from
 * an in-memory sample shop. Everything resets when the app reloads.
 *
 * It honours the same visibility rules as the real row level security:
 * shoppers see only live pieces and no orders; the signed-in owner sees
 * everything.
 */

export const DEMO_URL = "https://demo.sansignaturejewels.invalid";
export const DEMO_ANON_KEY = "demo-anon-key";

const OWNER_EMAIL = "owner@demo.local";
// Structurally valid JWT with a far-future expiry (not signed: nothing
// verifies it). supabase-js only needs the shape.
const OWNER_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJlbWFpbCI6Im93bmVyQGRlbW8ubG9jYWwiLCJleHAiOjQxMDI0NDQ4MDB9.demo";

let state: DemoState | null = null;
const db = (): DemoState => (state ??= createDemoState());

const CONTROL_PARAMS = new Set(["select", "order", "limit", "offset", "columns", "on_conflict"]);

export const demoFetch = (async (input: any, init?: RequestInit): Promise<Response> => {
  const href: string =
    typeof input === "string" ? input : input instanceof URL ? input.href : input?.url ?? "";

  // Anything that is not the pretend project is a real request (e.g. a
  // local photo being read for upload).
  if (!href.startsWith(DEMO_URL)) return fetch(input, init);

  // A short, realistic delay so loading states behave as they will live.
  await new Promise((resolve) => setTimeout(resolve, 80 + Math.random() * 140));

  const url = new URL(href);
  const method = String(init?.method ?? input?.method ?? "GET").toUpperCase();
  const headers = new Headers((init?.headers ?? input?.headers) as HeadersInit | undefined);
  const body = parseBody(init?.body);
  const owner = headers.get("authorization") === `Bearer ${OWNER_TOKEN}`;
  const path = url.pathname;

  try {
    if (path.startsWith("/auth/v1/")) return auth(path);
    if (path.startsWith("/functions/v1/")) return functions(path.slice("/functions/v1/".length), body);
    if (path.startsWith("/storage/v1/")) return json([]);
    if (path.startsWith("/rest/v1/rpc/")) return rpc(path.slice("/rest/v1/rpc/".length), body, owner);
    if (path.startsWith("/rest/v1/")) {
      return rest(path.slice("/rest/v1/".length), method, url, headers, body, owner);
    }
    return json({ message: "Not found" }, 404);
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Demo backend error" }, 500);
  }
}) as typeof fetch;

// ---------------------------------------------------------------- helpers

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function empty(status: number): Response {
  return new Response(null, { status });
}

function parseBody(raw: unknown): any {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const last10 = (phone: unknown) => String(phone ?? "").replace(/\D/g, "").slice(-10);

function discountPercent(p: any): number {
  return p.mrp && p.mrp > p.price ? Math.floor(((p.mrp - p.price) / p.mrp) * 100) : 0;
}

// ------------------------------------------------------------------ auth

function session() {
  return {
    access_token: OWNER_TOKEN,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 4102444800,
    refresh_token: "demo-refresh-token",
    user: {
      id: OWNER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: OWNER_EMAIL,
      app_metadata: { provider: "email" },
      user_metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
    },
  };
}

function auth(path: string): Response {
  // Any email and password sign in as the demo owner.
  if (path === "/auth/v1/token") return json(session());
  if (path === "/auth/v1/user") return json(session().user);
  if (path === "/auth/v1/logout") return empty(204);
  return json({});
}

// ------------------------------------------------------------ PostgREST

function rows(table: string, owner: boolean): any[] {
  const s = db();
  switch (table) {
    case "products":
      return s.products.filter((p) => owner || p.is_active);
    case "categories":
      return s.categories.filter((c) => owner || c.is_active);
    case "settings":
      return [s.settings];
    case "orders":
      return owner ? s.orders : [];
    case "admin_users":
      return owner ? [{ user_id: OWNER_ID, name: "Owner" }] : [];
    default:
      return [];
  }
}

/** Adds the computed and joined fields a real query would return. */
function shape(table: string, row: any): any {
  if (table === "products") {
    const category = db().categories.find((c) => c.id === row.category_id);
    return {
      ...row,
      discount_percent: discountPercent(row),
      // No online payments in the demo means no holds, so all stock is free.
      available_stock: row.stock,
      categories: category ? { name: category.name, slug: category.slug } : null,
    };
  }
  if (table === "orders") {
    return { ...row, order_items: row.order_items.map((i: any) => ({ ...i })) };
  }
  return { ...row };
}

function likeRegex(pattern: string, insensitive: boolean): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[%*]/g, ".*");
  return new RegExp(`^${escaped}$`, insensitive ? "i" : "");
}

function matches(actual: any, op: string, value: string): boolean {
  switch (op) {
    case "eq":
      return String(actual) === value;
    case "neq":
      return String(actual) !== value;
    case "gt":
      return Number(actual) > Number(value);
    case "gte":
      return Number(actual) >= Number(value);
    case "lt":
      return Number(actual) < Number(value);
    case "lte":
      return Number(actual) <= Number(value);
    case "like":
      return likeRegex(value, false).test(String(actual ?? ""));
    case "ilike":
      return likeRegex(value, true).test(String(actual ?? ""));
    case "is":
      return value === "null" ? actual === null || actual === undefined : String(actual) === value;
    case "in": {
      const list = value.replace(/^\(|\)$/g, "").split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      return list.includes(String(actual));
    }
    default:
      return true;
  }
}

function filterOne(row: any, key: string, raw: string): boolean {
  if (key === "or") {
    return raw
      .replace(/^\(|\)$/g, "")
      .split(",")
      .some((clause) => {
        const [field, op, ...rest] = clause.split(".");
        return matches(row[field], op, rest.join("."));
      });
  }
  const negate = raw.startsWith("not.");
  const [op, ...rest] = (negate ? raw.slice(4) : raw).split(".");
  const result = matches(row[key], op, rest.join("."));
  return negate ? !result : result;
}

function applyFilters(list: any[], params: URLSearchParams): any[] {
  let out = list;
  for (const [key, raw] of params.entries()) {
    if (CONTROL_PARAMS.has(key)) continue;
    out = out.filter((row) => filterOne(row, key, raw));
  }
  return out;
}

function applyOrder(list: any[], order: string | null): any[] {
  if (!order) return list;
  const [field, direction] = order.split(",")[0].split(".");
  const sign = direction === "desc" ? -1 : 1;
  return [...list].sort((a, b) => {
    const x = a[field];
    const y = b[field];
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x) < String(y) ? -1 : 1) * sign;
  });
}

function applyRange(list: any[], params: URLSearchParams, headers: Headers): any[] {
  const range = headers.get("range");
  if (range && /^\d+-\d+$/.test(range)) {
    const [from, to] = range.split("-").map(Number);
    return list.slice(from, to + 1);
  }
  const offset = Number(params.get("offset") ?? 0);
  const limit = params.has("limit") ? Number(params.get("limit")) : undefined;
  return list.slice(offset, limit === undefined ? undefined : offset + limit);
}

function respond(list: any[], headers: Headers): Response {
  if ((headers.get("accept") ?? "").includes("vnd.pgrst.object")) {
    if (list.length === 1) return json(list[0]);
    return json(
      {
        code: "PGRST116",
        details: `The result contains ${list.length} rows`,
        hint: null,
        message: "JSON object requested, multiple (or no) rows returned",
      },
      406,
    );
  }
  return json(list);
}

function rest(
  table: string,
  method: string,
  url: URL,
  headers: Headers,
  body: any,
  owner: boolean,
): Response {
  const s = db();
  const representation = (headers.get("prefer") ?? "").includes("return=representation");

  if (method === "GET" || method === "HEAD") {
    let list = rows(table, owner).map((row) => shape(table, row));
    list = applyFilters(list, url.searchParams);
    list = applyOrder(list, url.searchParams.get("order"));
    list = applyRange(list, url.searchParams, headers);
    return respond(list, headers);
  }

  if (!owner) {
    // Shoppers cannot write. Real RLS rejects inserts and silently
    // matches nothing on updates and deletes.
    return method === "POST"
      ? json({ code: "42501", message: "new row violates row-level security policy", details: null, hint: null }, 403)
      : empty(204);
  }

  if (method === "POST" && table === "products") {
    const incoming = (Array.isArray(body) ? body : [body]).filter(Boolean);
    for (const row of incoming) {
      if (s.products.some((p) => p.code === row.code)) {
        return json(
          { code: "23505", message: 'duplicate key value violates unique constraint "products_code_key"', details: null, hint: null },
          409,
        );
      }
    }
    const now = new Date().toISOString();
    const created = incoming.map((row, i) => ({
      tags: [],
      images: [],
      ...row,
      id: `piece-new-${Date.now()}-${i}`,
      created_at: now,
      updated_at: now,
    }));
    s.products.unshift(...created);
    return representation ? respond(created.map((row) => shape(table, row)), headers) : empty(201);
  }

  if (method === "PATCH") {
    const targets = applyFilters(rows(table, owner), url.searchParams);
    const patch = { ...(body ?? {}) };
    delete patch.discount_percent;
    delete patch.available_stock;
    delete patch.categories;
    for (const target of targets) {
      Object.assign(target, patch, table === "settings" ? {} : { updated_at: new Date().toISOString() });
    }
    return representation ? respond(targets.map((row) => shape(table, row)), headers) : empty(204);
  }

  if (method === "DELETE" && table === "products") {
    const doomed = new Set(applyFilters(rows(table, owner), url.searchParams));
    s.products = s.products.filter((p) => !doomed.has(p));
    return empty(204);
  }

  return json({ message: `The demo does not support ${method} on ${table}.` }, 400);
}

// ------------------------------------------------------------------- RPC

function rpc(name: string, args: any, owner: boolean): Response {
  const s = db();

  switch (name) {
    case "release_holds":
      return json(0);

    case "lookup_order": {
      const order = s.orders.find(
        (o) =>
          o.order_number === String(args?.p_order_number ?? "").trim().toUpperCase() &&
          last10(o.customer_phone) === last10(args?.p_phone),
      );
      if (!order) return json(null);
      return json({
        order_number: order.order_number,
        customer_name: order.customer_name,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        stock_conflict: order.stock_conflict,
        subtotal: order.subtotal,
        delivery_charge: order.delivery_charge,
        total: order.total,
        created_at: order.created_at,
        city: order.city,
        pincode: order.pincode,
        items: order.order_items.map((i: any) => ({ ...i })),
      });
    }

    case "admin_dashboard_stats": {
      if (!owner) {
        return json({ code: "P0001", message: "not authorised", details: null, hint: null }, 400);
      }
      const now = new Date();
      const paid = s.orders.filter((o) => o.payment_status === "paid");
      return json({
        products_total: s.products.length,
        products_live: s.products.filter((p) => p.is_active).length,
        out_of_stock: s.products.filter((p) => p.is_active && p.stock === 0).length,
        orders_total: s.orders.length,
        orders_new: s.orders.filter((o) => o.status === "placed").length,
        orders_today: s.orders.filter((o) => new Date(o.created_at).toDateString() === now.toDateString()).length,
        stock_conflicts: s.orders.filter((o) => o.stock_conflict && o.status !== "cancelled").length,
        revenue_paid: paid.reduce((sum, o) => sum + Number(o.total), 0),
        revenue_month: paid
          .filter((o) => {
            const d = new Date(o.created_at);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          })
          .reduce((sum, o) => sum + Number(o.total), 0),
      });
    }

    default:
      return json(null);
  }
}

// ------------------------------------------------------------- functions

function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

function validateCustomer(c: any): string | null {
  if (!c?.name || String(c.name).trim().length < 2) return "Please enter your full name.";
  if (!/^[6-9]\d{9}$/.test(last10(c.phone))) return "Please enter a valid 10-digit mobile number.";
  if (!c.address_line1 || String(c.address_line1).trim().length < 5) {
    return "Please enter your house / flat and street.";
  }
  if (!c.city || String(c.city).trim().length < 2) return "Please enter your city.";
  if (!c.state || String(c.state).trim().length < 2) return "Please select your state.";
  if (!/^[1-9]\d{5}$/.test(String(c.pincode ?? "").trim())) return "Please enter a valid 6-digit PIN code.";
  return null;
}

function functions(name: string, body: any): Response {
  if (name !== "place-order") {
    return fail("Online payment is switched off in this demo.", 400);
  }

  const s = db();
  const items = body?.items;
  if (!Array.isArray(items) || items.length === 0) return fail("Your bag is empty.");
  if (body?.payment_method !== "cod") {
    return fail("Online payment is switched off in this demo. Please choose cash on delivery.", 409);
  }
  if (!s.settings.cod_enabled) return fail("Cash on delivery is currently unavailable.", 409);

  const customer = body.customer ?? {};
  const invalid = validateCustomer(customer);
  if (invalid) return fail(invalid);

  const wanted = new Map<string, number>();
  for (const line of items) {
    const qty = Math.floor(Number(line?.quantity));
    if (!line?.product_id || !Number.isFinite(qty) || qty < 1) return fail("Invalid item quantity.");
    wanted.set(line.product_id, (wanted.get(line.product_id) ?? 0) + qty);
  }

  const lines: { product: any; qty: number }[] = [];
  let subtotal = 0;
  for (const [id, qty] of wanted) {
    const product = s.products.find((p) => p.id === id);
    if (!product || !product.is_active) {
      return fail(`"${product?.name ?? "A piece"}" is no longer available.`, 409);
    }
    if (product.stock < qty) {
      return fail(
        product.stock === 0 ? `"${product.name}" has just sold out.` : `Only ${product.stock} left of "${product.name}".`,
        409,
      );
    }
    lines.push({ product, qty });
    subtotal += Number(product.price) * qty;
  }

  const freeAbove = Number(s.settings.free_delivery_above ?? 0);
  const deliveryCharge = freeAbove > 0 && subtotal >= freeAbove ? 0 : Number(s.settings.delivery_charge ?? 0);
  const total = subtotal + deliveryCharge;

  for (const { product, qty } of lines) product.stock -= qty;

  const now = new Date();
  const orderNumber = `SJ-${now.getFullYear()}-${s.nextOrderSeq++}`;
  s.orders.unshift({
    id: `order-${now.getTime()}`,
    order_number: orderNumber,
    customer_name: String(customer.name).trim(),
    customer_phone: last10(customer.phone),
    customer_email: customer.email || null,
    address_line1: String(customer.address_line1).trim(),
    address_line2: customer.address_line2 || null,
    city: String(customer.city).trim(),
    state: String(customer.state).trim(),
    pincode: String(customer.pincode).trim(),
    subtotal,
    delivery_charge: deliveryCharge,
    total,
    payment_method: "cod",
    payment_status: "pending",
    razorpay_order_id: null,
    razorpay_payment_id: null,
    status: "placed",
    notes: customer.notes || null,
    stock_conflict: false,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    order_items: lines.map(({ product, qty }) => ({
      id: `${product.id}-${now.getTime()}`,
      product_id: product.id,
      product_name: product.name,
      product_code: product.code,
      product_image: product.images?.[0] ?? null,
      unit_price: Number(product.price),
      quantity: qty,
      line_total: Number(product.price) * qty,
    })),
  });

  return json({
    order_number: orderNumber,
    subtotal,
    delivery_charge: deliveryCharge,
    total,
    payment_method: "cod",
    hold_seconds: null,
    razorpay: null,
  });
}
