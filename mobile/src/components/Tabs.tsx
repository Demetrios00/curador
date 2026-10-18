import React from "react";
import { View, Text, TouchableOpacity, type ViewStyle } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
  style?: ViewStyle;
}

export function Tabs({ tabs, activeKey, onChange, style }: TabsProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          backgroundColor: colors.surfaceAlt,
          borderRadius: 10,
          padding: 3,
        },
        style,
      ]}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: "center",
              borderRadius: 8,
              backgroundColor: isActive ? colors.surface : "transparent",
              shadowColor: isActive ? "#000" : "transparent",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: isActive ? 0.08 : 0,
              shadowRadius: 2,
              elevation: isActive ? 1 : 0,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: isActive ? "600" : "400",
                color: isActive ? colors.primary : colors.textMuted,
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
