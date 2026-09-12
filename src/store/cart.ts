import { storage } from "@/lib/storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartLine, Product } from "@/lib/types";

type CartState = {
  lines: CartLine[];
  hydrated: boolean;
  add: (product: Product, quantity?: number) => { ok: boolean; message?: string };
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  replaceAll: (lines: CartLine[]) => void;
  quantityOf: (productId: string) => number;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      hydrated: false,

      add: (product, quantity = 1) => {
        if (product.stock <= 0) {
          return { ok: false, message: "This piece is sold out." };
        }

        // What can be bought right now, after pieces other shoppers are
        // holding while they pay.
        const available = product.available_stock ?? product.stock;
        if (available <= 0) {
          return {
            ok: false,
            message:
              "Another shopper is completing their purchase of this piece. Please check again in a few minutes.",
          };
        }

        const lines = get().lines;
        const existing = lines.find((l) => l.productId === product.id);
        const wanted = (existing?.quantity ?? 0) + quantity;

        if (wanted > available) {
          return {
            ok: false,
            message:
              existing
                ? `You already have all ${available} available in your bag.`
                : `Only ${available} available right now.`,
          };
        }

        const line: CartLine = {
          productId: product.id,
          code: product.code,
          name: product.name,
          price: Number(product.price),
          mrp: product.mrp === null ? null : Number(product.mrp),
          image: product.images?.[0] ?? null,
          stock: product.stock,
          available,
          quantity: wanted,
        };

        set({
          lines: existing
            ? lines.map((l) => (l.productId === product.id ? line : l))
            : [...lines, line],
        });
        return { ok: true };
      },

      setQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          set({ lines: get().lines.filter((l) => l.productId !== productId) });
          return;
        }
        set({
          lines: get().lines.map((l) =>
            l.productId === productId
              ? { ...l, quantity: Math.min(quantity, Math.max(l.stock, 1)) }
              : l,
          ),
        });
      },

      remove: (productId) =>
        set({ lines: get().lines.filter((l) => l.productId !== productId) }),

      clear: () => set({ lines: [] }),

      replaceAll: (lines) => set({ lines }),

      quantityOf: (productId) =>
        get().lines.find((l) => l.productId === productId)?.quantity ?? 0,
    }),
    {
      name: "ssj-cart-v1",
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ lines: state.lines }),
      onRehydrateStorage: () => (state) => {
        // Screens wait on `hydrated` so an empty-bag message never
        // flashes before the saved cart has loaded.
        state?.replaceAll(state.lines ?? []);
        useCart.setState({ hydrated: true });
      },
    },
  ),
);

export function cartSubtotal(lines: CartLine[]): number {
  return Math.round(lines.reduce((sum, l) => sum + l.price * l.quantity, 0) * 100) / 100;
}

export function cartSavings(lines: CartLine[]): number {
  return Math.round(
    lines.reduce(
      (sum, l) => sum + (l.mrp && l.mrp > l.price ? (l.mrp - l.price) * l.quantity : 0),
      0,
    ) * 100,
  ) / 100;
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}
