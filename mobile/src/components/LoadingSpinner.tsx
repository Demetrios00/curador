import React from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface LoadingSpinnerProps {
  size?: "small" | "large";
  color?: string;
  label?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = "large",
  color,
  label,
  fullScreen = false,
}: LoadingSpinnerProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: fullScreen ? 1 : undefined,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: fullScreen ? 0 : 32,
      }}
    >
      <ActivityIndicator size={size} color={color ?? colors.primary} />
      {label ? (
        <Text style={{ marginTop: 10, fontSize: 14, color: colors.textMuted }}>{label}</Text>
      ) : null}
    </View>
  );
}
