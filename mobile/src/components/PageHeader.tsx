import React, { type ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft } from "lucide-react-native";

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
  const isHero = variant === "hero";

  return (
    <View
      style={[
        {
          paddingTop: insets.top + 12,
          paddingBottom: 16,
          paddingHorizontal: 20,
        },
        isHero
          ? { backgroundColor: "#1aaa86" }
          : {
              backgroundColor: "#ffffff",
              borderBottomWidth: 1,
              borderBottomColor: "#e5e7eb",
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
                color={isHero ? "#ffffff" : "#374151"}
              />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: isHero ? 22 : 20,
                fontWeight: "700",
                color: isHero ? "#ffffff" : "#111827",
              }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  fontSize: 13,
                  marginTop: 2,
                  color: isHero ? "rgba(255,255,255,0.8)" : "#6b7280",
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
