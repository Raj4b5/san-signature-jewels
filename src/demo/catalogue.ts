import { Asset } from "expo-asset";

/**
 * Sample shop for the demo. Placeholder artwork stands in for photographs;
 * the names, prices and stock levels are made up but realistic.
 */

const PHOTOS = [
  require("../../assets/demo/piece-01.jpg"),
  require("../../assets/demo/piece-02.jpg"),
  require("../../assets/demo/piece-03.jpg"),
  require("../../assets/demo/piece-04.jpg"),
  require("../../assets/demo/piece-05.jpg"),
  require("../../assets/demo/piece-06.jpg"),
  require("../../assets/demo/piece-07.jpg"),
  require("../../assets/demo/piece-08.jpg"),
  require("../../assets/demo/piece-09.jpg"),
  require("../../assets/demo/piece-10.jpg"),
  require("../../assets/demo/piece-11.jpg"),
  require("../../assets/demo/piece-12.jpg"),
];

export const OWNER_ID = "00000000-0000-4000-8000-000000000001";

const CATEGORY_NAMES = [
  "Necklaces",
  "Earrings",
  "Bangles",
  "Bridal Sets",
  "Temple Jewellery",
  "Haaram",
  "Chokers",
  "Maang Tikka",
  "Rings",
  "Anklets",
  "Gifting",
];

// name, category (1-based), price, mrp, material, weight, stock
const PIECES: [string, number, number, number | null, string, number, number][] = [
  ["Emerald Kundan Choker Set", 1, 2450, 3200, "Gold-plated brass, kundan, green onyx", 62, 3],
  ["Ruby Temple Haaram", 5, 3890, 4900, "Antique gold finish, ruby stones", 118, 2],
  ["Pearl Drop Chandbali", 2, 1290, 1790, "Gold-plated, fresh water pearls", 24, 1],
  ["Antique Lakshmi Bangles (Set of 4)", 3, 1950, null, "Antique gold finish brass", 96, 0],
  ["Polki Bridal Necklace Set", 4, 5750, 7200, "Kundan polki, pearl drops", 145, 2],
  ["Jhumka Studs, Green", 2, 890, 1190, "Gold-plated, AD stones", 18, 6],
  ["Guttapusalu Long Haaram", 6, 4250, null, "Temple finish, pearl clusters", 132, 1],
  ["Navratna Choker", 7, 2990, 3990, "Nine-stone kundan setting", 71, 4],
  ["Kemp Stone Maang Tikka", 8, 740, 990, "Antique kemp, gold plating", 12, 5],
  ["Peacock Temple Necklace", 5, 3150, null, "Nakshi work, ruby and emerald", 104, 2],
  ["Rose Gold Pearl Layered Chain", 1, 1650, 2200, "Rose gold plating, shell pearls", 38, 7],
  ["Meenakari Chandbali, Blue", 2, 1450, 1890, "Meenakari enamel, gold plating", 27, 3],
];

function uuid(n: number, kind: string): string {
  return `${kind}-${String(n).padStart(4, "0")}`;
}

/** Photo URIs are resolved lazily: the web build pre-renders in Node. */
function photo(index: number): string {
  return Asset.fromModule(PHOTOS[index % PHOTOS.length]).uri;
}

export type DemoState = {
  categories: any[];
  products: any[];
  settings: any;
  orders: any[];
  nextOrderSeq: number;
};

export function createDemoState(): DemoState {
  const now = Date.now();
  const day = 86_400_000;

  const categories = CATEGORY_NAMES.map((name, i) => ({
    id: uuid(i + 1, "cat"),
    name,
    slug: name.toLowerCase().replace(/[^a-z]+/g, "-"),
    image_url: null,
    sort_order: i + 1,
    is_active: true,
    created_at: new Date(now - 30 * day).toISOString(),
  }));

  const products = PIECES.map(([name, cat, price, mrp, material, weight, stock], i) => ({
    id: uuid(i + 1, "piece"),
    code: `SJ-${String(i + 1).padStart(4, "0")}`,
    name,
    description:
      "Handcrafted in small numbers at our Hyderabad studio. Slight variation in stone placement and finish is natural in handmade work, and part of its charm.",
    category_id: categories[cat - 1].id,
    mrp,
    price,
    stock,
    material,
    weight_grams: weight,
    images: [photo(i), photo(i + 4)],
    tags: [],
    is_active: true,
    is_featured: i % 3 === 0,
    created_at: new Date(now - i * day).toISOString(),
    updated_at: new Date(now - i * day).toISOString(),
  }));

  const settings = {
    id: 1,
    store_name: "San Signature Jewels",
    tagline: "Elegance Crafted for You",
    phone_primary: "7981492668",
    phone_secondary: "8083583449",
    whatsapp_number: "917981492668",
    email: null,
    address:
      "Flat No. 109, Srinivasam by Sai Balaji Apartment, Puppalguda, Manikonda, Hyderabad, Telangana 500089",
    instagram_url: null,
    delivery_charge: 79,
    free_delivery_above: 1999,
    cod_enabled: true,
    // Online payment needs real Razorpay keys, so the demo takes COD only.
    online_payment_enabled: false,
    announcement:
      "This is a demo with sample pieces. Browse, order with cash on delivery, and try the Store Manager under More. Nothing here is saved.",
    sale_banner_text: "Festive offer - up to 30% off selected pieces",
    sale_banner_active: true,
    updated_at: new Date(now).toISOString(),
  };

  const item = (p: any, qty: number) => ({
    id: `${p.id}-line`,
    product_id: p.id,
    product_name: p.name,
    product_code: p.code,
    product_image: p.images[0],
    unit_price: p.price,
    quantity: qty,
    line_total: p.price * qty,
  });

  const orders: any[] = [
    {
      id: "order-0002",
      order_number: `SJ-${new Date(now).getFullYear()}-1002`,
      customer_name: "Lakshmi Reddy",
      customer_phone: "9876543210",
      customer_email: null,
      address_line1: "Flat 402, Aparna Towers, Road No. 3",
      address_line2: "Near Manikonda market",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500089",
      subtotal: products[1].price,
      delivery_charge: 0,
      total: products[1].price,
      payment_method: "cod",
      payment_status: "pending",
      razorpay_order_id: null,
      razorpay_payment_id: null,
      status: "placed",
      notes: "Gift wrap please",
      stock_conflict: false,
      created_at: new Date(now - 2 * 3_600_000).toISOString(),
      updated_at: new Date(now - 2 * 3_600_000).toISOString(),
      order_items: [item(products[1], 1)],
    },
    {
      id: "order-0001",
      order_number: `SJ-${new Date(now).getFullYear()}-1001`,
      customer_name: "Priya Sharma",
      customer_phone: "9123456780",
      customer_email: null,
      address_line1: "12-3-45, KPHB Colony",
      address_line2: null,
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500072",
      subtotal: products[5].price,
      delivery_charge: 79,
      total: products[5].price + 79,
      payment_method: "cod",
      payment_status: "pending",
      razorpay_order_id: null,
      razorpay_payment_id: null,
      status: "shipped",
      notes: null,
      stock_conflict: false,
      created_at: new Date(now - day).toISOString(),
      updated_at: new Date(now - day).toISOString(),
      order_items: [item(products[5], 1)],
    },
  ];

  orders.push({
    ...orders[1],
    id: "order-0000",
    order_number: `SJ-${new Date(now).getFullYear()}-1000`,
    customer_name: "Swathi Kumar",
    customer_phone: "9000012345",
    address_line1: "H.No 8-2-293, Road No. 14",
    address_line2: "Banjara Hills",
    pincode: "500034",
    subtotal: products[7].price,
    delivery_charge: 0,
    total: products[7].price,
    payment_status: "paid",
    status: "delivered",
    created_at: new Date(now - 3 * day).toISOString(),
    updated_at: new Date(now - 2 * day).toISOString(),
    order_items: [item(products[7], 1)],
  });

  return { categories, products, settings, orders, nextOrderSeq: 1003 };
}
