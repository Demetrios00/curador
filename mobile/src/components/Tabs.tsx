import React from "react";
import { View, Text, TouchableOpacity, type ViewStyle } from "react-native";

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
  return (
    <View
      style={[
        {
          flexDirection: "row",
          backgroundColor: "#f3f4f6",
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
              backgroundColor: isActive ? "#ffffff" : "transparent",
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
                color: isActive ? "#1aaa86" : "#6b7280",
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
