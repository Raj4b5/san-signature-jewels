# Publishing to Google Play

> Google changes these rules periodically. Everything here was accurate in September 2026,
> but check the requirement text inside Play Console as you go — it is always the
> authority.

---

## The one decision that changes your timeline

When you register your developer account, Google asks whether you are an **individual** or
an **organisation**. This choice is effectively permanent and it decides how long you wait.

| | Individual account | Organisation account |
|---|---|---|
| Fee | ₹2,000 one time | ₹2,000 one time |
| Needs a D-U-N-S number | No | **Yes** — free, 7–14 days in India |
| Closed test before going public | **Yes — 12 testers, opted in for 14 continuous days** | Not required |
| Store listing shows | Your personal name | **San Signature Jewels** |
| Realistic time to public launch | ~3 weeks | ~2 weeks (mostly the D-U-N-S wait) |

**For a real business, register as an organisation.** It skips the 12-tester requirement,
it puts your business name on the listing instead of yours, and the D-U-N-S wait usually
overlaps with your Razorpay KYC anyway.

Get a D-U-N-S number free from [Dun & Bradstreet](https://www.dnb.com/duns-number.html).
The business name and address you give them must match what you put in Play Console
**character for character**, or verification bounces.

If you are in a hurry and go individual: line up your 12 testers early. Family, friends,
regular customers. They each need a Google account, they each have to accept the test
invite, and they must stay opted in for 14 consecutive days. If someone drops out, the
clock restarts.

---

## 1. Register

1. [play.google.com/console](https://play.google.com/console) → pay the $25 / ₹2,000.
2. Choose **Organisation** (see above), enter the D-U-N-S number.
3. Complete identity verification — Google will ask for business documents.

---

## 2. Build the app file

Install the build tool and sign in once:

```bash
npm install -g eas-cli
eas login
eas init
```

`eas init` creates a project ID and writes it into `app.json`. Commit that change.

Now put your real Supabase values into `eas.json` — replace `YOUR-PROJECT` and
`YOUR-ANON-KEY` in all three profiles. These are the values the built app will use, and
`.env` is not uploaded to the build servers.

Then:

```bash
npm run build:android
```

The first build takes 15–25 minutes and runs on Expo's servers, not your machine. When it
finishes you get a link to download an `.aab` file — that is what Google wants.

**Let EAS manage your signing key.** It offers on the first build; say yes. If you manage
it yourself and lose it, you can never update the app again.

### Test it on a real phone first

```bash
eas build --platform android --profile preview
```

This gives an `.apk` you can install directly. Walk through the whole thing on a real
phone — browse, add to bag, place a test order, pay with a Razorpay test card — before you
submit anything.

---

## 3. Fill in the store listing

**Play Console → Create app.** Name it `San Signature Jewels`, English (India), App, Free.

### Copy you can paste

**Short description** (80 characters max):

```
Handmade & designer jewellery for every special moment. Crafted in Hyderabad.
```

**Full description** (4,000 characters max):

```
San Signature Jewels brings you handcrafted, designer imitation jewellery made in
small numbers at our studio in Hyderabad.

Every piece is made by hand, so no two are ever exactly alike. From bridal sets and
temple jewellery to chokers, chandbalis and everyday earrings, each design blends
traditional Indian craft with a modern eye.

WHAT YOU WILL FIND
• Necklaces, haarams and chokers
• Chandbali, jhumka and stud earrings
• Antique and temple finish bangles
• Complete bridal and occasion sets
• Maang tikka, rings and anklets
• Thoughtful gifting for weddings and festivals

WHY SHOP WITH US
• Handmade and designer — unique designs crafted with love and perfection
• Traditional, trendy and elegant — timeless beauty with modern style
• Bridal and occasion pieces for weddings, festivals and every celebration
• Perfect for gifting — make every moment memorable

SIMPLE AND SECURE
Browse the full collection, see clear prices with any savings shown, and pay securely
by UPI, card, net banking or wallet through Razorpay. Cash on delivery is available.
Track your order any time, and reach us on WhatsApp whenever you need us.

We deliver across India.

San Signature Jewels
Flat No. 109, Srinivasam by Sai Balaji Apartment,
Puppalguda, Manikonda, Hyderabad, Telangana 500089
Phone: 7981492668 / 8083583449

Thank you for supporting handmade and local.
```

### Graphics you need

| Asset | Size | Where to get it |
|---|---|---|
| App icon | 512 × 512 PNG | `assets/images/icon.png`, resized to 512 |
| Feature graphic | 1024 × 500 PNG | Make one from your visiting card artwork |
| Phone screenshots | at least 2, up to 8 | Take them on your phone — see below |

For screenshots, add 6–8 of your nicest pieces first so the app looks full, then capture:
the home page, the collection grid, one product page, and the bag. Those four tell the
whole story.

---

## 4. The forms Google requires

### Privacy policy — required, and you already have one

Your privacy policy URL is your live website plus `/policy/privacy`:

```
https://your-domain.com/policy/privacy
```

Put the website online first (see [SETUP.md](SETUP.md) section 3). Google checks the link
loads.

### Data safety

You collect data. Declare it honestly — this is the section that most often causes a
rejection, and the answers for this app are:

| Question | Answer |
|---|---|
| Does your app collect or share user data? | **Yes** |
| Personal info — Name | Collected, not shared. Purpose: **App functionality** (order fulfilment) |
| Personal info — Email address | Collected (optional), not shared. Purpose: **App functionality** |
| Personal info — Phone number | Collected, not shared. Purpose: **App functionality** |
| Personal info — Address | Collected, not shared. Purpose: **App functionality** |
| Financial info — Payment info | **Not collected** — Razorpay handles it; the app never sees card or UPI details |
| Photos | **Not collected from customers.** The app requests no photo permission at all — the owner picks product pictures through Android's system photo picker, and the camera is used only by the owner to photograph pieces |
| Location, Contacts, Messages, Files, Health | Not collected |
| Is data encrypted in transit? | **Yes** |
| Can users request deletion? | **Yes** — the privacy policy explains how |

### Content rating

Fill in the questionnaire. It is a shopping app with no objectionable content — you will
get **Rated for 3+ / Everyone**.

### App access

Tick **All functionality is available without special access**. The Store Manager is not
customer-facing, so Google does not need a login. If a reviewer asks anyway, give them a
throwaway admin account rather than your real one.

### Ads

Declare **No ads**.

---

## 5. Payments — you are fine using Razorpay

A question that worries people: does Google Play force you to use their billing and take
30%?

**No.** Google Play Billing is required only for *digital* goods and content. You are
selling physical jewellery that is shipped to a customer's home, which is explicitly
exempt. Razorpay, UPI and cash on delivery are all allowed.

What you must not do is sell anything digital in the app — gift cards redeemable for
digital content, subscriptions to online content, that sort of thing. You are not, so
this never comes up.

---

## 6. Submit

1. **Production → Create new release**
2. Upload the `.aab` from step 2
3. Release notes: `First release of the San Signature Jewels shop.`
4. Countries: **India** (add more later if you ever ship abroad)
5. **Send for review**

First review takes anywhere from a few days to two weeks. Later updates are usually
reviewed within a day or two.

### If you are on an individual account

You cannot go straight to Production. Instead:

1. **Testing → Closed testing → Create track**
2. Add your 12+ testers by email
3. Each tester opens the opt-in link and installs the app
4. Keep them all opted in for **14 continuous days**
5. Play Console then shows an **Apply for production access** button

Use those two weeks — ask the testers what confused them, and fix it.

---

## 7. Shipping updates

```bash
npm run build:android
eas submit --platform android
```

`eas.json` is set to `autoIncrement`, so the version number bumps itself.

### The shortcut worth knowing

For anything that is only JavaScript — a wording change, a colour, a layout fix, a bug —
you do not need a new Play Store release at all:

```bash
eas update --branch production --message "Fixed the bag total on small screens"
```

Users get it the next time they open the app, with no review and no waiting. You only
need a full rebuild when you change `app.json`, add a library with native code, or change
the icon.

---

## A realistic schedule

| When | Do this |
|---|---|
| Day 1 | Supabase setup. Start the D-U-N-S application. Start Razorpay KYC. |
| Day 1–3 | Add 15–20 pieces. Publish the website. Share the link on Instagram. |
| Day 3–5 | Razorpay approved → test a real payment end to end. |
| Day 7–14 | D-U-N-S arrives → register the Play account. |
| Day 14 | Build, fill the listing, submit. |
| Day 16–21 | Live on the Play Store. |

The website is the part worth rushing. It costs nothing, it is live the same day, and it
is already earning while the app is in review.
