# Setup

Three accounts, roughly an hour end to end. Do them in this order — the app works after
step 1, and can take money after step 2.

---

## 1. Supabase — the database and photo storage

### 1.1 Create the project

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. **New project**.
   - Name: `san-signature-jewels`
   - Database password: generate one and **save it somewhere safe** — it is not shown again.
   - Region: **South Asia (Mumbai) `ap-south-1`**. This matters. It is the difference
     between the shop feeling instant and feeling sluggish for customers in India.
3. Wait about two minutes while it provisions.

### 1.2 Create the tables

Open **SQL Editor** in the left sidebar. For each of these three files, open it from this
project, copy the whole thing, paste it in, and press **Run**. Order matters.

1. `supabase/migrations/0001_init.sql` — tables, security rules, the 11 starting categories
2. `supabase/migrations/0002_storage.sql` — the photo bucket
3. `supabase/migrations/0003_order_functions.sql` — payment settlement

Each should report success. If one errors, stop and fix it before running the next.

### 1.3 Copy your keys

**Project Settings → Data API**. You need two values:

- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public** key — a long string starting `eyJ...`

In the project folder, copy `.env.example` to `.env` and paste them in:

```
EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Then restart the dev server with a cleared cache:

```bash
npx expo start -c
```

> The anon key is **meant** to be public — it ships inside the app. What protects your
> data is the row level security in `0001_init.sql`: customers can read only live
> products, and nothing else. The key you must never put in `.env` is the
> **service_role** key.

### 1.4 Create your owner login

**Authentication → Users → Add user → Create new user**

- Email: your email
- Password: pick a strong one
- Tick **Auto Confirm User**

Then go back to the **SQL Editor** and run this, with your email substituted:

```sql
insert into admin_users (user_id, name)
select id, 'Owner' from auth.users where email = 'you@example.com';
```

Signing in is not enough on its own — being in `admin_users` is what grants store access.
That is deliberate: if someone ever signs up on your project, they get nothing.

To add a second person later (a family member helping with uploads), repeat 1.4 with
their email.

**Check it worked:** open the app → **More → Store owner sign in** → your email and
password. You should land on the Store Manager dashboard.

---

## 2. Razorpay — taking payments

### 2.1 Open the account

1. Sign up at [razorpay.com](https://razorpay.com).
2. Complete KYC. Keep ready:
   - PAN card (personal PAN is fine for a sole proprietorship)
   - Bank account details in the business name
   - Address proof
   - GST number if you have one — not mandatory below the threshold
3. Approval usually takes 2–4 working days.

While you wait, everything below works in **Test Mode** with fake card numbers.

### 2.2 Get your keys

**Settings → API Keys → Generate Key.** You get a Key ID and a Key Secret.

- Test keys start `rzp_test_`
- Live keys start `rzp_live_`

**The Key Secret is shown once.** Save it immediately.

### 2.3 Give the keys to Supabase

The secret must never go in `.env` — it would ship inside the app, and anyone could read
it. It lives in Supabase instead.

**Supabase → Edge Functions → Secrets → Add new secret**, three times:

| Name | Value |
|---|---|
| `RAZORPAY_KEY_ID` | `rzp_test_...` (swap for the live key when you go live) |
| `RAZORPAY_KEY_SECRET` | the secret from 2.2 |
| `RAZORPAY_WEBHOOK_SECRET` | any long random string you invent — you will paste the same one into Razorpay in 2.5 |

### 2.4 Deploy the Edge Functions

Install the Supabase CLI once:

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
```

(The project ref is the `abcdefgh` part of your project URL.)

Then deploy all three:

```bash
supabase functions deploy place-order
supabase functions deploy verify-payment
supabase functions deploy razorpay-webhook --no-verify-jwt
```

> `--no-verify-jwt` on the last one is required. Razorpay's servers call it, and they
> have no login token. It is not a security hole — that function verifies Razorpay's
> HMAC signature before it trusts a single byte.

### 2.5 Point Razorpay at the webhook

**Razorpay Dashboard → Settings → Webhooks → Add New Webhook**

- **URL:** `https://YOUR-PROJECT.supabase.co/functions/v1/razorpay-webhook`
- **Secret:** the same `RAZORPAY_WEBHOOK_SECRET` string from 2.3
- **Active events:** tick `payment.captured`, `payment.failed`, `order.paid`

### 2.6 Test a payment

With test keys in place, place a real order through the app and pay with:

```
Card    4111 1111 1111 1111
Expiry  any future date
CVV     any 3 digits
OTP     1234
```

Or choose UPI and use `success@razorpay`.

Then check: **Store Manager → Orders** should show the order as **Paid**, and the piece's
stock should have gone down by one.

### 2.7 Going live

When KYC is approved, generate **live** keys and update `RAZORPAY_KEY_ID` and
`RAZORPAY_KEY_SECRET` in Supabase. Create a **second** webhook for the live mode with the
same URL. Nothing in the app changes.

---

## 3. Put the website online

```bash
npm run build:web
```

This produces a `dist/` folder of plain static files. Drag that folder onto
[app.netlify.com/drop](https://app.netlify.com/drop) and it is live in seconds. Vercel and
Cloudflare Pages work the same way.

Point your own domain at it when you have one. Two reasons this is worth doing before the
app is approved:

- You can start sharing the link on Instagram and WhatsApp straight away.
- The Play Store requires a **public privacy policy URL**, and yours will be
  `https://your-domain/policy/privacy`.

If you use a custom domain, update it in `app.json` under `android.intentFilters` so that
links to your shop open the app for people who have installed it.

---

## Adding your first pieces

**Store Manager → Add a new piece.**

- The product code is filled in for you (`SJ-0001`, `SJ-0002`, …).
- The first photo is the cover. Tap the star on any other photo to promote it.
- **Selling price** is what the customer pays. **Was** is the struck-through price — leave
  it blank if there is no offer.
- The quick discount buttons (10%, 20%, …) set both at once.
- **Pieces in stock** — set it to 1 for a one-off. At 0 the piece shows as sold out but
  stays visible, which is often what you want for something you can remake.

Photos are resized and compressed on the phone before uploading, so a 5 MB camera photo
becomes roughly 200 KB. That keeps the shop fast on mobile data and keeps you inside the
Supabase free tier for a long time.

---

## Troubleshooting

**The app shows "Almost ready"**
`.env` is missing or still has placeholder values. Fix it, then `npx expo start -c`. The
`-c` matters — environment variables are baked in at build time and cached.

**"This account does not have store access"**
The login is valid but not in `admin_users`. Run the `insert` from step 1.4.

**Photos will not upload**
Check `0002_storage.sql` ran, and that **Storage** shows a `product-images` bucket marked
public.

**Payment succeeds but the order stays "Payment pending"**
The webhook is not reaching Supabase. Check the URL in Razorpay, confirm the secret
matches exactly, and look at **Edge Functions → Logs** in Supabase. Also confirm you
deployed `razorpay-webhook` with `--no-verify-jwt`.

**Changes to a product are not showing**
Pull down to refresh. The catalogue is cached in memory for the session.
