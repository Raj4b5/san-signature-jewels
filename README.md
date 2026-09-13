# San Signature Jewels

Handmade & designer jewellery shop — one codebase that ships as an **Android app on
Google Play** and as a **website**.

> Elegance Crafted for You
> Flat No. 109, Srinivasam by Sai Balaji Apartment, Puppalguda, Manikonda, Hyderabad, Telangana 500089
> 7981492668 · 8083583449

---

## What this is

| | |
|---|---|
| **Customers** | Browse the collection, search and filter, add to bag, pay by UPI / card / net banking (Razorpay) or cash on delivery, track their order. |
| **You (the owner)** | Sign in to a Store Manager built into the same app. Photograph a piece, set its price and discount, and it is live in the shop seconds later. Confirm and track orders. |
| **Runs on** | Android (Play Store) and any browser. Same code, same database, same photos. |

---

## See it right now — no accounts needed

```bash
npm install
npm run demo
```

Press `w` to open it in your browser, or scan the QR code with the **Expo Go** app on your
phone (same Wi-Fi; use `npm run demo -- --tunnel` if the phone is on another network).

The demo runs on a built-in sample shop, so everything works without Supabase or Razorpay:
browse, place a cash-on-delivery order, then open **More → Store owner sign in → Enter the
demo Store Manager** to see that order arrive and to add a piece of your own. A green
**DEMO** badge stays on every screen, and nothing is saved.

**To share it as a link**, run `npm run build:demo` and drag the `dist-demo` folder onto
[app.netlify.com/drop](https://app.netlify.com/drop).

The demo is assembled only when you ask for it: a normal build does not contain the sample
shop or any of its code.

**What to do next, in order: [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)**

---

## The three things you need

The app itself is finished. It needs three accounts to come alive:

1. **Supabase** — the database and photo storage. Free tier is plenty.
2. **Razorpay** — to take online payments. Needs business KYC.
3. **Google Play Developer** — to publish on the Play Store. ₹2,000, one time.

**→ Full walkthrough: [docs/SETUP.md](docs/SETUP.md)**
**→ Publishing to Play: [docs/PLAY_STORE.md](docs/PLAY_STORE.md)**

Until Supabase is connected the app shows a setup screen with these steps, rather than
an error.

---

## Quick start

```bash
npm install
cp .env.example .env     # then paste your Supabase URL and anon key in
npx expo start
```

Press `w` for the browser, or scan the QR code with **Expo Go** on your phone.

| Command | What it does |
|---|---|
| `npm run demo` | The app with a built-in sample shop — no accounts needed |
| `npm start` | Dev server (press `w` for web, `a` for Android) |
| `npm run web` | Dev server, browser only |
| `npm run build:web` | Website into `dist/`, ready for Netlify or Cloudflare Pages |
| `npm run build:demo` | The demo as a website, into `dist-demo/` |
| `npm run build:android` | Play Store `.aab` via EAS (builds in the cloud) |
| `npx tsc --noEmit` | Typecheck |

You do **not** need Android Studio or Java. EAS builds the Android package in the cloud.

---

## How it is put together

```
src/
  app/                      every screen (file = route, Expo Router)
    (shop)/                 the 4 customer tabs
      index.tsx             home — hero, categories, new arrivals, featured
      shop.tsx              the collection — search, filter, sort, infinite scroll
      bag.tsx               cart, re-checked against live prices on every open
      more.tsx              track order, contact, policies, owner sign-in
    product/[id].tsx        one piece — gallery, price, add to bag, WhatsApp enquiry
    checkout.tsx            delivery details + payment choice
    pay.tsx                 Razorpay checkout, then verification
    order/[orderNumber].tsx order confirmation and status timeline
    policy/[doc].tsx        privacy policy + terms (also your Play Store policy URL)
    admin/                  Store Manager — login, dashboard, pieces, orders, settings
  components/               UI kit, brand marks, product card, Razorpay bridge
  demo/                     the sample shop used by `npm run demo` (never in real builds)
  lib/                      Supabase client, data access, image upload, formatting
  store/                    cart, saved address, auth (persisted on device)
  theme/                    colours, type, spacing — all brand tokens live here

supabase/
  migrations/               the database. Run these four files in order.
  functions/                Edge Functions — the only code that touches money
```

### Three decisions worth knowing

**Prices are never trusted from the app.** When someone checks out, the app sends only
product IDs and quantities. The `place-order` Edge Function looks up the real prices in
the database and computes the total itself. Editing the price in a browser's dev tools
achieves nothing.

**Payments are confirmed twice.** The app verifies Razorpay's signature the moment
checkout returns, so the customer sees a confirmed order immediately. Razorpay's webhook
independently confirms it server-side, which covers the customer closing the app
mid-payment. Both call the same `mark_order_paid`, which is written so that running it
twice decrements stock once.

**One-off pieces are held while someone pays.** Most pieces here are made once. When a
shopper starts an online payment, their pieces are set aside for 15 minutes, and anyone else
sees them as *Reserved* until the payment completes or the hold runs out. The check and the
hold happen in a single locked database transaction, so two people can never both reach the
payment screen for the last piece — and the same is true for cash on delivery. Holds expire
on their own; there is no background job that could fail and leave a piece stuck. If a
payment ever lands after its hold ran out and the piece has meanwhile sold, the order is
still recorded as paid and flagged on your dashboard, so you can make another or refund.

---

## Your daily routine

1. Open the app → **More → Store owner sign in**.
2. **Add a new piece** — photograph it or pick from the gallery, type a name and price, save.
3. New pieces appear under *Just arrived* on the home page immediately.

To run a sale: **Pieces → Select →** tick the pieces → enter a percentage → **Apply**.
The old price becomes the struck-through price automatically.

To change delivery charges, switch payment methods on or off, or put a banner across the
home page: **Store settings**.

---

## Design

Dark ground, antique gold, and the emerald of the pendant on the visiting card as the one
accent. Cormorant Garamond for the wordmark, Jost for everything functional. Every colour,
font and spacing value is in [`src/theme/index.ts`](src/theme/index.ts) — change it there
and it changes everywhere.

The app icon is generated from the SJ monogram; the source script is in the repository
history if you ever want to regenerate it at another size.

---

## Costs

| | |
|---|---|
| Supabase | Free tier covers a catalogue this size comfortably |
| Razorpay | No monthly fee; ~2% + GST per online transaction |
| Google Play | ₹2,000 once, forever |
| Web hosting | Free on Netlify, Vercel or Cloudflare Pages |
| EAS builds | Free tier is enough for occasional releases |

So: roughly ₹2,000 to start, then only the percentage on money you actually collect.
