import React, { type ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: ReactNode;
  variant?: "default" | "hero";
}

export function PageHeader({
  title,
  subtitle,
  showBack,
  right,
  variant = "default",
}: PageHeaderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const isHero = variant === "hero";

  return (
    <View
      style={[
        {
          paddingTop: insets.top + 12,
          paddingBottom: 16,
          paddingHorizontal: 20,
        },
        // Ideia 2: a variante `hero` mantém a cor de marca fixa de
        // propósito (mesma decisão da Home) — só `default` acompanha o
        // tema.
        isHero
          ? { backgroundColor: "#1aaa86" }
          : {
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", flex: 1 }}>
          {showBack && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ marginLeft: -8, marginRight: 4, padding: 8, borderRadius: 999 }}
              accessibilityLabel="Voltar"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft
                size={20}
                color={isHero ? "#ffffff" : colors.text}
              />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: isHero ? 22 : 20,
                fontWeight: "700",
                color: isHero ? "#ffffff" : colors.text,
              }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  fontSize: 13,
                  marginTop: 2,
                  color: isHero ? "rgba(255,255,255,0.8)" : colors.textMuted,
                }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {right ? <View style={{ marginLeft: 8 }}>{right}</View> : null}
      </View>
    </View>
  );
}
