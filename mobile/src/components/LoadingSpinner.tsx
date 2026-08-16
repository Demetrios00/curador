import React from "react";
import { View, ActivityIndicator, Text } from "react-native";

interface LoadingSpinnerProps {
  size?: "small" | "large";
  color?: string;
  label?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({
  size = "large",
  color = "#1aaa86",
  label,
  fullScreen = false,
}: LoadingSpinnerProps) {
  return (
    <View
      style={{
        flex: fullScreen ? 1 : undefined,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: fullScreen ? 0 : 32,
      }}
    >
      <ActivityIndicator size={size} color={color} />
      {label ? (
        <Text style={{ marginTop: 10, fontSize: 14, color: "#6b7280" }}>{label}</Text>
      ) : null}
    </View>
  );
}
