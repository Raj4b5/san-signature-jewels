import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, fonts, radius, spacing } from "@/theme";
import { Container, GoldRule, SectionTitle, Small, Spacer } from "@/components/ui";
import { Monogram } from "@/components/Brand";

const STEPS = [
  {
    title: "Create a Supabase project",
    body: "Go to supabase.com, create a free project, and choose the Mumbai (ap-south-1) region so the shop is fast in India.",
  },
  {
    title: "Run the database setup",
    body: "In the Supabase SQL Editor, paste and run each file from supabase/migrations in order: 0001, 0002, then 0003.",
  },
  {
    title: "Copy your keys",
    body: "Project Settings > Data API gives you the Project URL and the anon public key.",
  },
  {
    title: "Create the .env file",
    body: "Copy .env.example to .env in the project folder and paste both values in.",
  },
  {
    title: "Restart with a clear cache",
    body: "Stop the server and run: npx expo start -c",
  },
];

/**
 * Shown instead of the shop when EXPO_PUBLIC_SUPABASE_* are missing.
 * The whole app depends on them, so a clear instruction beats a crash.
 */
export function SetupRequired() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Container width={560}>
        <View style={{ alignItems: "center" }}>
          <Monogram size={54} />
          <Spacer size={spacing.lg} />
          <SectionTitle style={{ textAlign: "center" }}>Almost ready</SectionTitle>
          <Spacer size={spacing.sm} />
          <Small style={{ textAlign: "center", lineHeight: 21 }}>
            San Signature Jewels is not connected to its database yet. Five steps and the shop
            is live.
          </Small>
        </View>

        <Spacer size={spacing.xl} />
        <GoldRule />
        <Spacer size={spacing.xl} />

        <View style={{ gap: spacing.lg }}>
          {STEPS.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.number}>
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Spacer size={spacing.xl} />
        <View style={styles.codeBlock}>
          <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co</Text>
          <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...</Text>
        </View>

        <Spacer size={spacing.lg} />
        <View style={styles.note}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.gold} />
          <Text style={styles.noteText}>
            The anon key is safe to ship. Never put the service role key or the Razorpay secret
            in .env -- those belong in Supabase Edge Function secrets.
          </Text>
        </View>

        <Spacer size={spacing.xl} />
        <Small style={{ textAlign: "center", fontSize: 11.5 }}>
          Full instructions are in README.md and docs/SETUP.md.
        </Small>
      </Container>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.xl, paddingTop: spacing.xxxl, paddingBottom: spacing.xxxl },

  step: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  number: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: { fontFamily: fonts.bodySemi, fontSize: 12, color: colors.gold },
  stepTitle: { fontFamily: fonts.bodyMedium, fontSize: 14.5, color: colors.cream },
  stepBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: 2,
  },

  codeBlock: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
  },
  code: {
    fontFamily: "monospace",
    fontSize: 11.5,
    color: colors.goldLight,
  },

  note: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "rgba(212,175,55,0.07)",
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  noteText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12.5,
    lineHeight: 19,
    color: colors.textMuted,
  },
});
