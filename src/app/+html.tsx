import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * The HTML shell for the web build only. Native ignores this file.
 *
 * It paints the page dark before React mounts (otherwise there is a
 * white flash on every load), and carries the share-card metadata that
 * makes a link pasted into WhatsApp or Instagram look like a shop
 * rather than a bare URL.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        <title>San Signature Jewels | Handmade Designer Jewellery, Hyderabad</title>
        <meta
          name="description"
          content="Handmade and designer imitation jewellery for every special moment. Traditional, trendy and elegant bridal, festive and everyday pieces. Hyderabad, Telangana."
        />
        <meta name="theme-color" content="#0B0705" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="San Signature Jewels" />
        <meta property="og:title" content="San Signature Jewels" />
        <meta property="og:description" content="Elegance Crafted for You. Handmade & designer jewellery." />
        <meta name="twitter:card" content="summary_large_image" />

        <link rel="icon" href="/favicon.png" />

        {/*
          Razorpay Checkout. Loading it in the shell rather than at
          checkout time means the payment sheet opens instantly instead
          of after a network round-trip on a slow connection.
        */}
        <script src="https://checkout.razorpay.com/v1/checkout.js" defer />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const BASE_CSS = `
  html, body { background-color: #0B0705; color-scheme: dark; }
  body { margin: 0; overscroll-behavior-y: none; }
  * { -webkit-tap-highlight-color: transparent; }
  ::selection { background: rgba(212,175,55,0.3); }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-track { background: #0B0705; }
  ::-webkit-scrollbar-thumb { background: #332413; border-radius: 5px; }
  ::-webkit-scrollbar-thumb:hover { background: #4A3518; }
`;
