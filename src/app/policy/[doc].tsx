import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, fonts, spacing } from "@/theme";
import { Container, GoldRule, Loader, Row, Screen, Small, Spacer } from "@/components/ui";
import { fetchSettings } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

type Block = { heading: string; body: string[] };

export default function PolicyScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useAsync(fetchSettings, []);

  if (settings.loading) return <Loader />;

  const s = settings.data;
  const phone = s?.phone_primary ?? "7981492668";
  const email = s?.email ?? "";
  const address = s?.address ?? "Puppalguda, Manikonda, Hyderabad, Telangana 500089";

  const isPrivacy = doc === "privacy";
  const title = isPrivacy ? "Privacy Policy" : "Terms, Shipping & Returns";
  const blocks = isPrivacy ? privacyBlocks(phone, email, address) : termsBlocks(phone, email, address);

  return (
    <Screen scroll contentStyle={{ paddingBottom: spacing.xxxl }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Container width={720} style={{ paddingHorizontal: spacing.lg }}>
          <Row gap={spacing.md}>
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={22} color={colors.cream} />
            </Pressable>
            <Text style={styles.headerTitle}>{title}</Text>
          </Row>
        </Container>
      </View>

      <Container width={720} style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl }}>
        <Small style={{ fontSize: 12 }}>Last updated 12 September 2026</Small>
        <Spacer size={spacing.lg} />
        <GoldRule />
        <Spacer size={spacing.lg} />

        {blocks.map((block) => (
          <View key={block.heading} style={{ marginBottom: spacing.xl }}>
            <Text style={styles.heading}>{block.heading}</Text>
            {block.body.map((paragraph, index) => (
              <Text key={index} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}

        <GoldRule />
        <Spacer size={spacing.lg} />
        <Text style={styles.paragraph}>
          San Signature Jewels{"\n"}
          {address}
          {"\n"}Phone: {phone}
          {email ? `\nEmail: ${email}` : ""}
        </Text>
      </Container>
    </Screen>
  );
}

function privacyBlocks(phone: string, email: string, address: string): Block[] {
  return [
    {
      heading: "Who we are",
      body: [
        `San Signature Jewels is a handmade and designer jewellery business based at ${address}. This policy explains what we collect through our app and website, why we collect it, and what we do with it.`,
      ],
    },
    {
      heading: "What we collect",
      body: [
        "You can browse the entire collection without giving us anything at all. We only ask for information when you place an order.",
        "When you order, we collect your name, mobile number, delivery address, and your email address if you choose to give one. We also store what you ordered and the amount.",
        "We do not collect your location, contacts, or any data from other apps. The app asks for photo and camera access only for the shop owner's account, in order to upload photographs of jewellery. Customers are never asked for either.",
      ],
    },
    {
      heading: "Payment information",
      body: [
        "We never see or store your card number, UPI PIN, CVV, or bank credentials. Online payments are handled entirely by Razorpay Software Private Limited, a payment gateway authorised by the Reserve Bank of India.",
        "We receive only a payment reference and whether the payment succeeded. Razorpay's own privacy policy governs what they collect during payment.",
      ],
    },
    {
      heading: "How we use your information",
      body: [
        "Your details are used to pack and deliver your order, to contact you about that order, and to keep the records a business is required to keep.",
        "We may message you on WhatsApp or call you about an order you have placed. We do not send marketing messages to customers who have not asked for them.",
      ],
    },
    {
      heading: "Who we share it with",
      body: [
        "We do not sell your information to anybody, and we do not share it for advertising.",
        "We share only what is necessary with the delivery partner carrying your parcel, and with Razorpay to process your payment. Our data is stored with Supabase, our hosting provider.",
        "We will disclose information if a law or a lawful order requires it.",
      ],
    },
    {
      heading: "How long we keep it",
      body: [
        "Order records are kept for as long as required for accounting and tax purposes. You may ask us to delete your personal details at any time, and we will do so unless we are legally required to keep them.",
      ],
    },
    {
      heading: "Children",
      body: [
        "This app is not directed at children under 13, and we do not knowingly collect information from them.",
      ],
    },
    {
      heading: "Your choices",
      body: [
        `You can ask us what we hold about you, ask us to correct it, or ask us to delete it. Write to us on ${phone}${email ? ` or ${email}` : ""} and we will respond within a reasonable time.`,
        "Uninstalling the app removes everything saved on your device, including your bag and saved address.",
      ],
    },
    {
      heading: "Changes",
      body: [
        "If this policy changes we will update this page and the date at the top. Continuing to use the app after a change means you accept the updated policy.",
      ],
    },
  ];
}

function termsBlocks(phone: string, email: string, address: string): Block[] {
  return [
    {
      heading: "Handmade pieces",
      body: [
        "Every piece sold here is handmade in small numbers. Slight variation in colour, finish, stone placement and weight between the photograph and the piece you receive is normal and is not a defect.",
        "Photographs are taken in natural light. Screens vary, so shades may appear slightly different in person.",
      ],
    },
    {
      heading: "Materials",
      body: [
        "Our jewellery is imitation and fashion jewellery. It is not gold, silver or any precious metal unless a listing explicitly says so, and it is not sold by metal weight.",
        "Please keep pieces away from water, perfume and moisture, and store them in a dry pouch. Plating life depends on care and use.",
      ],
    },
    {
      heading: "Prices",
      body: [
        "All prices are in Indian Rupees and include applicable taxes. Where a struck-through price is shown, it is the price at which we previously offered that piece.",
        "Prices and discounts can change at any time. The price that applies to your order is the price shown when you place it.",
      ],
    },
    {
      heading: "Orders and stock",
      body: [
        "Because pieces are handmade in very limited quantities, something in your bag may sell out before you check out. If that happens we will tell you before payment.",
        "We may cancel an order if a piece turns out to be unavailable or if there has been an obvious pricing error. In either case you are refunded in full.",
      ],
    },
    {
      heading: "Payment",
      body: [
        "You may pay online through Razorpay (UPI, cards, net banking and wallets) or, where offered, by cash on delivery.",
        "An order is confirmed only once payment is received, or once we confirm a cash-on-delivery order by phone or WhatsApp.",
      ],
    },
    {
      heading: "Shipping",
      body: [
        "Orders are usually dispatched within 2 to 4 working days. Delivery within Telangana typically takes 2 to 4 days, and 4 to 8 days elsewhere in India.",
        "We currently ship within India only. Delays caused by the courier, weather, festivals or strikes are outside our control.",
        "Local customers are welcome to collect in person by arrangement.",
      ],
    },
    {
      heading: "Returns and exchanges",
      body: [
        "If a piece arrives damaged or is not what you ordered, contact us within 48 hours of delivery with photographs and we will replace it or refund you in full.",
        "Please record an unbroken opening video of the parcel. It is the fastest way for us to resolve a damage claim with the courier.",
        "Because these are handmade personal-wear items, we cannot accept returns simply because of a change of mind, and earrings cannot be returned for hygiene reasons once worn.",
      ],
    },
    {
      heading: "Refunds",
      body: [
        "Approved refunds are sent back to the original payment method within 5 to 7 working days of approval. Your bank may take a few days more to show the credit.",
        "Delivery charges are refunded only where the fault was ours.",
      ],
    },
    {
      heading: "Contact",
      body: [
        `For anything at all, reach us on ${phone}${email ? ` or ${email}` : ""}. We are at ${address}.`,
        "The fastest way to reach us is WhatsApp.",
      ],
    },
  ];
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.surfaceSunken,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontFamily: fonts.display, fontSize: 23, color: colors.goldLight, flex: 1 },

  heading: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.goldLight,
    marginBottom: spacing.sm,
  },
  paragraph: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 23,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
});
