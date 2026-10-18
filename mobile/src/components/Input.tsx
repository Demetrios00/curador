import React from "react";
import {
  View,
  Text,
  TextInput,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
  Platform,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({ label, error, containerStyle, style, ...props }: InputProps) {
  const { colors } = useTheme();
  return (
    <View style={[{ marginBottom: 4 }, containerStyle]}>
      {label ? (
        <Text
          style={{
            fontSize: 14,
            fontWeight: "500",
            color: colors.text,
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
            borderColor: error ? colors.danger : colors.borderInput,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            fontSize: 14,
            color: colors.text,
            backgroundColor: colors.surface,
          },
          style,
        ]}
        placeholderTextColor={colors.placeholder}
        {...props}
      />
      {error ? (
        <Text style={{ fontSize: 12, color: colors.danger, marginTop: 4 }}>{error}</Text>
      ) : null}
    </View>
  );
}
