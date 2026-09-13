import { supabase, callFunction } from "./supabase";
import { getHoldKey } from "./holdKey";
import type {
  Category,
  DashboardStats,
  Order,
  PlaceOrderResult,
  Product,
  Settings,
  CheckoutCustomer,
  CartLine,
} from "./types";

const PRODUCT_COLUMNS =
  "id, code, name, description, category_id, mrp, price, stock, material, weight_grams, " +
  "images, tags, is_active, is_featured, discount_percent, created_at, updated_at";

/**
 * Reads add `available_stock`, a database-computed field (stock minus
 * live checkout holds). Writes leave it out: it is not a real column.
 */
const PRODUCT_READ_COLUMNS = `${PRODUCT_COLUMNS}, available_stock`;

// ---------------------------------------------------------------------
// Catalogue (public)
// ---------------------------------------------------------------------

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw error;
  return data as Settings;
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export type CatalogQuery = {
  categoryId?: string | null;
  search?: string;
  sort?: "newest" | "price_low" | "price_high" | "discount";
  featuredOnly?: boolean;
  inStockOnly?: boolean;
  limit?: number;
  offset?: number;
};

export async function fetchProducts(query: CatalogQuery = {}): Promise<Product[]> {
  const {
    categoryId,
    search,
    sort = "newest",
    featuredOnly,
    inStockOnly,
    limit = 24,
    offset = 0,
  } = query;

  let request = supabase
    .from("products")
    .select(`${PRODUCT_READ_COLUMNS}, categories(name, slug)`)
    .eq("is_active", true);

  if (categoryId) request = request.eq("category_id", categoryId);
  if (featuredOnly) request = request.eq("is_featured", true);
  if (inStockOnly) request = request.gt("stock", 0);

  if (search && search.trim()) {
    // Escape the PostgREST or() delimiters so a comma or paren in the
    // search box cannot break out of the filter expression.
    const term = search.trim().replace(/[,()]/g, " ");
    request = request.or(`name.ilike.%${term}%,code.ilike.%${term}%,description.ilike.%${term}%`);
  }

  switch (sort) {
    case "price_low":
      request = request.order("price", { ascending: true });
      break;
    case "price_high":
      request = request.order("price", { ascending: false });
      break;
    case "discount":
      request = request.order("discount_percent", { ascending: false });
      break;
    default:
      request = request.order("created_at", { ascending: false });
  }

  const { data, error } = await request.range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select(`${PRODUCT_READ_COLUMNS}, categories(name, slug)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Product) ?? null;
}

/** "You may also like" -- same category, excluding the piece on screen. */
export async function fetchRelated(product: Product, limit = 8): Promise<Product[]> {
  let request = supabase
    .from("products")
    .select(PRODUCT_READ_COLUMNS)
    .eq("is_active", true)
    .neq("id", product.id)
    .limit(limit);

  request = product.category_id
    ? request.eq("category_id", product.category_id)
    : request.eq("is_featured", true);

  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}

/**
 * Re-reads cart lines against the live catalogue. Prices and stock can
 * move between adding to the bag and checking out, and the customer
 * should see that before they pay, not after.
 */
export async function refreshCartLines(lines: CartLine[]): Promise<CartLine[]> {
  if (lines.length === 0) return [];
  const { data, error } = await supabase
    .from("products")
    .select("id, code, name, price, mrp, stock, images, is_active, available_stock")
    .in("id", lines.map((l) => l.productId));
  if (error) throw error;

  const live = new Map((data ?? []).map((p: any) => [p.id, p]));

  return lines.flatMap((line) => {
    const p = live.get(line.productId);
    if (!p || !p.is_active) return [];
    return [
      {
        ...line,
        name: p.name,
        code: p.code,
        price: Number(p.price),
        mrp: p.mrp === null ? null : Number(p.mrp),
        image: p.images?.[0] ?? null,
        stock: p.stock,
        available: p.available_stock ?? p.stock,
        // Capped by physical stock only. A piece another shopper is paying
        // for stays in the bag -- their hold may lapse in a few minutes.
        quantity: Math.min(line.quantity, Math.max(p.stock, 0)),
      },
    ];
  });
}

// ---------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------

export async function placeOrder(
  lines: CartLine[],
  customer: CheckoutCustomer,
  paymentMethod: "razorpay" | "cod",
): Promise<PlaceOrderResult> {
  return callFunction<PlaceOrderResult>("place-order", {
    hold_key: await getHoldKey(),
    items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
    customer: {
      name: customer.name,
      phone: customer.phone,
      email: customer.email || null,
      address_line1: customer.address_line1,
      address_line2: customer.address_line2 || null,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
      notes: customer.notes || null,
    },
    payment_method: paymentMethod,
  });
}

export async function verifyPayment(result: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return callFunction<{ ok: boolean; order_number: string; payment_status: string }>(
    "verify-payment",
    result,
  );
}

/**
 * Free any pieces this device is holding for an unfinished payment, so
 * other shoppers are not kept waiting. Holds also expire on their own, so
 * failure here (e.g. offline) is harmless and deliberately silent.
 */
export async function releaseHolds(): Promise<void> {
  try {
    await supabase.rpc("release_holds", { p_hold_key: await getHoldKey() });
  } catch {
    // ignore
  }
}

export async function lookupOrder(orderNumber: string, phone: string) {
  const { data, error } = await supabase.rpc("lookup_order", {
    p_order_number: orderNumber,
    p_phone: phone,
  });
  if (error) throw error;
  return data as null | {
    order_number: string;
    customer_name: string;
    status: string;
    payment_status: string;
    payment_method: string;
    stock_conflict: boolean;
    subtotal: number;
    delivery_charge: number;
    total: number;
    created_at: string;
    city: string;
    pincode: string;
    items: {
      product_name: string;
      product_code: string;
      product_image: string | null;
      unit_price: number;
      quantity: number;
      line_total: number;
    }[];
  };
}

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("admin_dashboard_stats");
  if (error) throw error;
  return data as DashboardStats;
}

/** Admin list: unlike the shop, this includes hidden and sold-out pieces. */
export async function adminFetchProducts(opts: {
  search?: string;
  categoryId?: string | null;
  status?: "all" | "live" | "hidden" | "sold_out";
  limit?: number;
  offset?: number;
} = {}): Promise<Product[]> {
  const { search, categoryId, status = "all", limit = 50, offset = 0 } = opts;

  let request = supabase
    .from("products")
    .select(`${PRODUCT_READ_COLUMNS}, categories(name, slug)`)
    .order("created_at", { ascending: false });

  if (categoryId) request = request.eq("category_id", categoryId);
  if (status === "live") request = request.eq("is_active", true).gt("stock", 0);
  if (status === "hidden") request = request.eq("is_active", false);
  if (status === "sold_out") request = request.eq("stock", 0);

  if (search && search.trim()) {
    const term = search.trim().replace(/[,()]/g, " ");
    request = request.or(`name.ilike.%${term}%,code.ilike.%${term}%`);
  }

  const { data, error } = await request.range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}

export type ProductDraft = {
  id?: string;
  code: string;
  name: string;
  description: string | null;
  category_id: string | null;
  mrp: number | null;
  price: number;
  stock: number;
  material: string | null;
  weight_grams: number | null;
  images: string[];
  tags: string[];
  is_active: boolean;
  is_featured: boolean;
};

export async function saveProduct(draft: ProductDraft): Promise<Product> {
  const payload = { ...draft };
  delete (payload as any).id;

  const request = draft.id
    ? supabase.from("products").update(payload).eq("id", draft.id)
    : supabase.from("products").insert(payload);

  const { data, error } = await request.select(PRODUCT_COLUMNS).single();
  if (error) throw error;
  return data as unknown as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

/**
 * Next free SKU, e.g. SJ-0043. Reads the highest existing code rather
 * than counting rows, so deleting a product never reissues its code.
 */
export async function nextProductCode(): Promise<string> {
  const { data } = await supabase
    .from("products")
    .select("code")
    .like("code", "SJ-%")
    .order("code", { ascending: false })
    .limit(1);

  const last = data?.[0]?.code ?? "";
  const digits = Number(last.replace(/^SJ-/, "")) || 0;
  return `SJ-${String(digits + 1).padStart(4, "0")}`;
}

/** Apply a percentage discount across a set of pieces in one action. */
export async function bulkDiscount(productIds: string[], percentOff: number): Promise<number> {
  if (productIds.length === 0 || percentOff <= 0 || percentOff >= 100) return 0;

  const { data, error } = await supabase
    .from("products")
    .select("id, price, mrp")
    .in("id", productIds);
  if (error) throw error;

  const updates = (data ?? []).map((p: any) => {
    // The original price becomes the MRP so the saving is visible, but
    // only the first time -- re-discounting must not inflate the MRP.
    const baseline = p.mrp && p.mrp > p.price ? Number(p.mrp) : Number(p.price);
    return {
      id: p.id,
      mrp: baseline,
      price: Math.round(baseline * (1 - percentOff / 100)),
    };
  });

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("products")
      .update({ mrp: update.mrp, price: update.price })
      .eq("id", update.id);
    if (updateError) throw updateError;
  }
  return updates.length;
}

/** Undo bulk pricing: restore price to MRP and clear the strike-through. */
export async function clearDiscount(productIds: string[]): Promise<number> {
  if (productIds.length === 0) return 0;

  const { data, error } = await supabase
    .from("products")
    .select("id, price, mrp")
    .in("id", productIds);
  if (error) throw error;

  let changed = 0;
  for (const p of data ?? []) {
    if (!p.mrp || Number(p.mrp) <= Number(p.price)) continue;
    const { error: updateError } = await supabase
      .from("products")
      .update({ price: Number(p.mrp), mrp: null })
      .eq("id", p.id);
    if (updateError) throw updateError;
    changed++;
  }
  return changed;
}

export async function adminFetchOrders(opts: {
  status?: string;
  search?: string;
  limit?: number;
} = {}): Promise<Order[]> {
  const { status, search, limit = 60 } = opts;

  let request = supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status === "conflict") request = request.eq("stock_conflict", true);
  else if (status && status !== "all") request = request.eq("status", status);
  if (search && search.trim()) {
    const term = search.trim().replace(/[,()]/g, " ");
    request = request.or(
      `order_number.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`,
    );
  }

  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []) as Order[];
}

export async function updateOrderStatus(
  id: string,
  status: string,
  paymentMethod?: string,
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  // Cash on delivery is collected when the parcel is handed over. Without
  // this, COD orders never count towards revenue on the dashboard.
  if (status === "delivered" && paymentMethod === "cod") patch.payment_status = "paid";

  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) throw error;
}

/** The owner has refunded or remade the piece: clear the warning. */
export async function resolveStockConflict(id: string): Promise<void> {
  const { error } = await supabase.from("orders").update({ stock_conflict: false }).eq("id", id);
  if (error) throw error;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const { error } = await supabase.from("settings").update(patch).eq("id", 1);
  if (error) throw error;
}

export async function saveCategory(
  draft: { id?: string; name: string; slug: string; sort_order: number; is_active: boolean },
): Promise<void> {
  const payload = { ...draft };
  delete (payload as any).id;

  const { error } = draft.id
    ? await supabase.from("categories").update(payload).eq("id", draft.id)
    : await supabase.from("categories").insert(payload);
  if (error) throw error;
}
