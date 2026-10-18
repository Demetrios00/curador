import React, { type ReactNode } from "react";
import { View, Text } from "react-native";
import { Card } from "./Card";
import { useTheme } from "@/contexts/ThemeContext";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        paddingVertical: 48,
      }}
    >
      <Card style={{elevation:0, padding: 24, alignItems: "center", borderRadius: 16, borderStyle: "dashed" }}>
        {icon ? <View style={{ marginBottom: 16 }}>{icon}</View> : null}
        <Text
          style={{
            fontSize: 17,
            fontWeight: "600",
            color: colors.text,
            textAlign: "center",
          }}
        >
          {title}
        </Text>
        {description ? (
          <Text
            style={{
              fontSize: 14,
              color: colors.textMuted,
              textAlign: "center",
              marginTop: 6,
              lineHeight: 20,
            }}
          >
            {description}
          </Text>
        ) : null}
        {action ? <View style={{ marginTop: 20 }}>{action}</View> : null}
      </Card>
    </View>
  );
}
