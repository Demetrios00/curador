import React from "react";
import { View, Text, type ViewStyle } from "react-native";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  style?: ViewStyle;
}

const variantStyles: Record<BadgeVariant, { container: ViewStyle; text: { color: string } }> = {
  default: {
    container: { backgroundColor: "#1aaa86", borderWidth: 0 },
    text: { color: "#ffffff" },
  },
  secondary: {
    container: { backgroundColor: "#0e5e70", borderWidth: 0 },
    text: { color: "#ffffff" },
  },
  destructive: {
    container: { backgroundColor: "#ef4444", borderWidth: 0 },
    text: { color: "#ffffff" },
  },
  outline: {
    container: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#d1d5db" },
    text: { color: "#374151" },
  },
  success: {
    container: { backgroundColor: "#d1fae5", borderWidth: 0 },
    text: { color: "#065f46" },
  },
  warning: {
    container: { backgroundColor: "#fef3c7", borderWidth: 0 },
    text: { color: "#92400e" },
  },
};

export function Badge({ variant = "default", children, style }: BadgeProps) {
  const { container, text } = variantStyles[variant];
  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 2,
        },
        container,
        style,
      ]}
    >
      <Text style={[{ fontSize: 11, fontWeight: "600" }, text]}>{children}</Text>
    </View>
  );
}
