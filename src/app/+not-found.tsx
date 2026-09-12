import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "@/theme";
import { Container, GoldButton, Screen, SectionTitle, Small, Spacer } from "@/components/ui";
import { Monogram } from "@/components/Brand";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <Container width={400} style={{ alignItems: "center" }}>
          <Monogram size={56} />
          <Spacer size={spacing.xl} />
          <SectionTitle style={{ textAlign: "center" }}>This page does not exist</SectionTitle>
          <Spacer size={spacing.sm} />
          <Small style={{ textAlign: "center" }}>
            The link may have changed, or the piece may no longer be listed.
          </Small>
          <Spacer size={spacing.xxl} />
          <GoldButton title="Go to the shop" onPress={() => router.replace("/")} />
        </Container>
      </View>
    </Screen>
  );
}
