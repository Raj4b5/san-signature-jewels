import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { colors } from "@/theme";
import type { RazorpayCheckoutProps } from "./RazorpayCheckout";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

/**
 * Web implementation. checkout.js is already in the page head (see
 * +html.tsx), so this only has to wait for it and open the modal over
 * the current page -- no WebView involved.
 */
export function RazorpayCheckout({
  options,
  onSuccess,
  onDismiss,
  onFailure,
}: RazorpayCheckoutProps) {
  // React 18+ mounts effects twice in development; without this the
  // payment modal would open two overlapping copies.
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;

    let cancelled = false;
    let waited = 0;

    function open() {
      if (cancelled) return;

      if (!window.Razorpay) {
        waited += 120;
        if (waited > 12000) {
          onFailure("The payment library did not load. Please check your connection.");
          return;
        }
        setTimeout(open, 120);
        return;
      }

      try {
        const razorpay = new window.Razorpay({
          ...options,
          handler: (response: any) => onSuccess(response),
          modal: {
            escape: false,
            backdropclose: false,
            ondismiss: () => onDismiss(),
          },
          retry: { enabled: false },
        });

        razorpay.on("payment.failed", (response: any) => {
          onFailure(response?.error?.description ?? "The payment did not go through.");
        });

        razorpay.open();
      } catch (e) {
        onFailure(e instanceof Error ? e.message : "Could not open the payment screen.");
      }
    }

    open();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.ink,
      }}
    >
      <ActivityIndicator color={colors.gold} size="large" />
    </View>
  );
}
