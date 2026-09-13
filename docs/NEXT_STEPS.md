# Launch checklist

The order that gets San Signature Jewels selling soonest. Things you can do in parallel
are marked. Detailed instructions live in [SETUP.md](SETUP.md) and
[PLAY_STORE.md](PLAY_STORE.md) — this page is the running order.

---

## Today — see it, and start the slow paperwork

- [ ] **Look at the demo.** `npm install`, then `npm run demo`. Press `w` for the browser,
      or scan the QR code with **Expo Go** on your phone (same Wi-Fi). Try a cash-on-delivery
      order, then **More → Store owner sign in → Enter the demo Store Manager**.
- [ ] **Show the shop owner** *(optional)* — `npm run build:demo`, then drag the
      `dist-demo` folder onto [app.netlify.com/drop](https://app.netlify.com/drop) for a
      link that opens on any phone. It says DEMO on every screen.
- [ ] **Apply for a D-U-N-S number** *(parallel, 7–14 days)* — free, at
      [dnb.com](https://www.dnb.com/duns-number.html). The business name and address must match
      what you will type into Play Console exactly. [PLAY_STORE.md → the one decision](PLAY_STORE.md)
- [ ] **Open a Razorpay account and start KYC** *(parallel, 2–4 working days)* — PAN, bank
      account, address proof. [SETUP.md §2.1](SETUP.md)

## Day 1–2 — make it real

- [ ] **Create the Supabase project** in the **Mumbai** region, and run the four files in
      `supabase/migrations` in order. [SETUP.md §1.1–1.2](SETUP.md)
- [ ] **Create `.env`** with the project URL and anon key. [SETUP.md §1.3](SETUP.md)
- [ ] **Create your owner login** and add it to `admin_users`. [SETUP.md §1.4](SETUP.md)
- [ ] **Check:** `npx expo start -c`, sign in under **More**, add one real piece with a photo.

## Day 2–4 — fill the shop and put it online

- [ ] **Photograph and add 15–20 pieces.** Good light, plain dark background, the first photo
      is the cover. Feature your best 4–6 for the home page.
- [ ] **Set delivery charges and the banner** in **Store settings**.
- [ ] **Publish the website:** `npm run build:web`, drag `dist` onto Netlify. [SETUP.md §3](SETUP.md)
- [ ] **Check the two links Google and customers need** — open these directly in a new tab:
      `https://your-site/policy/privacy` and any product page link. Both must load.
- [ ] **Share the website link** on Instagram and WhatsApp. It works before the app exists.

## When Razorpay approves you

- [ ] **Deploy the three Edge Functions** and add the Razorpay secrets to Supabase.
      [SETUP.md §2.3–2.4](SETUP.md)
- [ ] **Add the webhook** in Razorpay. [SETUP.md §2.5](SETUP.md)
- [ ] **Test with Razorpay test mode** — card `4111 1111 1111 1111`. The order must show
      **Paid** in Store Manager and the stock must drop by one. [SETUP.md §2.6](SETUP.md)
- [ ] **Switch to live keys** and set late-payment auto-refunds. [SETUP.md §2.7–2.8](SETUP.md)

## When the D-U-N-S number arrives

- [ ] **Register the Google Play developer account as an Organisation** (₹2,000).
- [ ] **Build the app:** put the real Supabase values into `eas.json`, then
      `npm run build:android`. Install the `preview` build on a real phone first.
      [PLAY_STORE.md §2](PLAY_STORE.md)
- [ ] **Decide the app ID before the first upload** — `com.sansignaturejewels.shop` in
      `app.json` can never change afterwards.
- [ ] **Store listing, data safety form, content rating** — the wording is ready to paste.
      [PLAY_STORE.md §3–4](PLAY_STORE.md)
- [ ] **Submit for review.** First review: a few days to two weeks.

---

## Housekeeping

- Pieces you add in the **demo** vanish on reload; nothing there touches your real shop.
- If you own a domain, point it at the website and update `android.intentFilters` in
  `app.json` (it currently holds the placeholder `sansignaturejewels.com`).
- Every change you make is safe to push to the private GitHub repository — secrets such as
  `.env` are excluded by `.gitignore`.
