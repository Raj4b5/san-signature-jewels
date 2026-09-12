export type Category = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Product = {
  id: string;
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
  discount_percent: number;
  /**
   * Stock minus pieces held by shoppers who are paying right now. Computed
   * by the database; absent on write responses, so read it with a fallback.
   */
  available_stock?: number;
  created_at: string;
  updated_at: string;
  /** Joined in on catalogue queries. */
  categories?: { name: string; slug: string } | null;
};

export type Settings = {
  id: number;
  store_name: string;
  tagline: string;
  phone_primary: string;
  phone_secondary: string | null;
  whatsapp_number: string;
  email: string | null;
  address: string;
  instagram_url: string | null;
  delivery_charge: number;
  free_delivery_above: number;
  cod_enabled: boolean;
  online_payment_enabled: boolean;
  announcement: string | null;
  sale_banner_text: string | null;
  sale_banner_active: boolean;
};

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type OrderItem = {
  id?: string;
  product_id: string | null;
  product_name: string;
  product_code: string;
  product_image: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;
  subtotal: number;
  delivery_charge: number;
  total: number;
  payment_method: "razorpay" | "cod";
  payment_status: PaymentStatus;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  status: OrderStatus;
  notes: string | null;
  /** Paid for a piece that had already gone. Needs a refund or a remake. */
  stock_conflict: boolean;
  created_at: string;
  order_items?: OrderItem[];
};

export type CartLine = {
  productId: string;
  code: string;
  name: string;
  price: number;
  mrp: number | null;
  image: string | null;
  stock: number;
  /** What could be bought at the last check, after other shoppers' holds. */
  available?: number;
  quantity: number;
};

export type CheckoutCustomer = {
  name: string;
  phone: string;
  email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
};

export type PlaceOrderResult = {
  order_number: string;
  subtotal: number;
  delivery_charge: number;
  total: number;
  payment_method: "razorpay" | "cod";
  /** Seconds the pieces are held for payment. Null for cash on delivery. */
  hold_seconds: number | null;
  razorpay: {
    order_id: string;
    key_id: string;
    amount: number;
    currency: string;
    name: string;
    prefill: { name: string; contact: string; email: string };
  } | null;
};

export type DashboardStats = {
  products_total: number;
  products_live: number;
  out_of_stock: number;
  orders_total: number;
  orders_new: number;
  orders_today: number;
  stock_conflicts: number;
  revenue_paid: number;
  revenue_month: number;
};
