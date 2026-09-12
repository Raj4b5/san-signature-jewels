import { Linking, Platform } from "react-native";
import { money } from "./format";
import type { Product, Settings } from "./types";

/** Digits only, with the 91 country code, as wa.me requires. */
function waNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("91") ? digits : `91${digits.slice(-10)}`;
}

export function openWhatsApp(settings: Settings | null | undefined, message: string) {
  const number = waNumber(settings?.whatsapp_number ?? settings?.phone_primary ?? "7981492668");
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  Linking.openURL(url).catch(() => {});
}

export function callShop(settings: Settings | null | undefined, which: "primary" | "secondary" = "primary") {
  const number =
    which === "secondary"
      ? settings?.phone_secondary ?? settings?.phone_primary
      : settings?.phone_primary;
  if (!number) return;
  Linking.openURL(`tel:${number.replace(/\D/g, "")}`).catch(() => {});
}

export function openMaps(settings: Settings | null | undefined) {
  const address = settings?.address ?? "Puppalguda, Manikonda, Hyderabad, Telangana 500089";
  const query = encodeURIComponent(address);
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?q=${query}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
  Linking.openURL(url).catch(() => {});
}

export function openInstagram(settings: Settings | null | undefined) {
  if (!settings?.instagram_url) return;
  Linking.openURL(settings.instagram_url).catch(() => {});
}

/** Pre-filled enquiry so the owner sees exactly which piece is meant. */
export function enquiryMessage(product: Product): string {
  return [
    `Hello San Signature Jewels,`,
    ``,
    `I would like to know more about this piece:`,
    `${product.name} (${product.code})`,
    `Price: ${money(product.price)}`,
  ].join("\n");
}

export function orderHelpMessage(orderNumber: string): string {
  return `Hello San Signature Jewels, I need help with my order ${orderNumber}.`;
}
