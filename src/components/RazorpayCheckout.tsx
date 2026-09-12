import React, { useMemo } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
import { WebView } from "react-native-webview";
import { colors } from "@/theme";

export type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; contact: string; email: string };
  theme: { color: string; backdrop_color?: string };
};

export type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayCheckoutProps = {
  options: RazorpayOptions;
  onSuccess: (result: RazorpaySuccess) => void;
  onDismiss: () => void;
  onFailure: (message: string) => void;
};

/**
 * Native implementation: Razorpay has no Expo-managed SDK, so Checkout
 * runs inside a WebView. This is Razorpay's own supported fallback and
 * keeps the app free of custom native code, which is what lets the
 * whole project build on EAS without ejecting.
 */
export function RazorpayCheckout({
  options,
  onSuccess,
  onDismiss,
  onFailure,
}: RazorpayCheckoutProps) {
  const html = useMemo(() => buildHtml(options), [options]);

  return (
    <WebView
      source={{ html, baseUrl: "https://checkout.razorpay.com" }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      setSupportMultipleWindows={false}
      style={{ flex: 1, backgroundColor: colors.ink }}
      startInLoadingState
      renderLoading={() => (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.ink,
          }}
        >
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      )}
      /**
       * UPI apps are opened with custom schemes (upi://, phonepe://,
       * tez://). A WebView cannot follow those itself, so hand them to
       * Android and stop the navigation.
       */
      onShouldStartLoadWithRequest={(request) => {
        if (/^https?:/.test(request.url) || request.url === "about:blank") return true;
        Linking.openURL(request.url).catch(() => {});
        return false;
      }}
      onMessage={(event) => {
        let message: any;
        try {
          message = JSON.parse(event.nativeEvent.data);
        } catch {
          return;
        }

        switch (message.type) {
          case "success":
            onSuccess(message.payload);
            break;
          case "dismiss":
            onDismiss();
            break;
          case "failed":
            onFailure(message.payload?.description ?? "The payment did not go through.");
            break;
          case "error":
            onFailure(message.message ?? "Could not open the payment screen.");
            break;
        }
      }}
      onError={() => onFailure("Could not reach the payment page. Check your connection.")}
    />
  );
}

/**
 * `</script>` inside a JSON string would close the tag early, so it is
 * split before being embedded. The prefill fields are customer-typed,
 * which makes this a real path, not a theoretical one.
 */
function embed(value: unknown): string {
  return JSON.stringify(value).replace(/<\//g, "<\\/");
}

function buildHtml(options: RazorpayOptions): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: ${colors.ink}; }
    </style>
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  </head>
  <body>
    <script>
      (function () {
        function send(message) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify(message));
          }
        }

        var options = ${embed(options)};

        options.handler = function (response) {
          send({ type: 'success', payload: response });
        };
        options.modal = {
          escape: false,
          backdropclose: false,
          ondismiss: function () { send({ type: 'dismiss' }); }
        };
        options.retry = { enabled: false };

        try {
          if (typeof Razorpay === 'undefined') {
            send({ type: 'error', message: 'Payment library did not load. Check your connection.' });
            return;
          }
          var rzp = new Razorpay(options);
          rzp.on('payment.failed', function (response) {
            send({ type: 'failed', payload: response.error });
          });
          rzp.open();
        } catch (e) {
          send({ type: 'error', message: String((e && e.message) || e) });
        }
      })();
    </script>
  </body>
</html>`;
}
