import { storage } from "@/lib/storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CheckoutCustomer } from "@/lib/types";

export const EMPTY_CUSTOMER: CheckoutCustomer = {
  name: "",
  phone: "",
  email: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "Telangana", // most orders are local; still fully editable
  pincode: "",
  notes: "",
};

type CheckoutState = {
  customer: CheckoutCustomer;
  hydrated: boolean;
  update: (patch: Partial<CheckoutCustomer>) => void;
  reset: () => void;
};

/**
 * Delivery details persist so a returning customer does not retype an
 * address. `notes` is deliberately excluded -- it belongs to one order,
 * not to the person.
 */
export const useCheckout = create<CheckoutState>()(
  persist(
    (set, get) => ({
      customer: EMPTY_CUSTOMER,
      hydrated: false,
      update: (patch) => set({ customer: { ...get().customer, ...patch } }),
      reset: () => set({ customer: EMPTY_CUSTOMER }),
    }),
    {
      name: "ssj-checkout-v1",
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        customer: { ...state.customer, notes: "" },
      }),
      onRehydrateStorage: () => () => {
        useCheckout.setState({ hydrated: true });
      },
    },
  ),
);
