import React from "react";
import {
  View,
  Text,
  TextInput,
  type TextInputProps,
  type ViewStyle,
  Platform,
} from "react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({ label, error, containerStyle, style, ...props }: InputProps) {
  return (
    <View style={[{ marginBottom: 4 }, containerStyle]}>
      {label ? (
        <Text
          style={{
            fontSize: 14,
            fontWeight: "500",
            color: "#374151",
            marginBottom: 4,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        style={[
          {
            height: Platform.OS === "android" ? 48 : 40,
            borderWidth: 1,
            borderColor: error ? "#ef4444" : "#d1d5db",
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            fontSize: 14,
            color: "#111827",
            backgroundColor: "#ffffff",
          },
          style,
        ]}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {error ? (
        <Text style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>{error}</Text>
      ) : null}
    </View>
  );
}
