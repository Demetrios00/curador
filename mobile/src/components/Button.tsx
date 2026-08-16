import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";

type Variant = "default" | "outline" | "ghost" | "destructive" | "secondary";
type Size = "default" | "sm" | "lg" | "icon";

interface ButtonProps extends TouchableOpacityProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: React.ReactNode;
}

const containerBase: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
};

const containerVariant: Record<Variant, ViewStyle> = {
  default: { backgroundColor: "#1aaa86" },
  destructive: { backgroundColor: "#ef4444" },
  secondary: { backgroundColor: "#0e5e70" },
  outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#1aaa86" },
  ghost: { backgroundColor: "transparent" },
};

const containerSize: Record<Size, ViewStyle> = {
  default: { height: 40, paddingHorizontal: 16 },
  sm: { height: 36, paddingHorizontal: 12 },
  lg: { height: 44, paddingHorizontal: 32 },
  icon: { height: 40, width: 40 },
};

const textBase: TextStyle = {
  fontSize: 14,
  fontWeight: "500",
};

const textVariant: Record<Variant, TextStyle> = {
  default: { color: "#ffffff" },
  destructive: { color: "#ffffff" },
  secondary: { color: "#ffffff" },
  outline: { color: "#1aaa86" },
  ghost: { color: "#1aaa86" },
};

const textSize: Record<Size, TextStyle> = {
  default: { fontSize: 14 },
  sm: { fontSize: 13 },
  lg: { fontSize: 16 },
  icon: { fontSize: 14 },
};

export function Button({
  variant = "default",
  size = "default",
  loading = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const containerStyle: ViewStyle[] = [
    containerBase,
    containerVariant[variant],
    containerSize[size],
    disabled || loading ? { opacity: 0.5 } : {},
    style as ViewStyle,
  ];

  const textStyle: TextStyle[] = [textBase, textVariant[variant], textSize[size]];

  return (
    <TouchableOpacity
      style={containerStyle}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" || variant === "ghost" ? "#1aaa86" : "#ffffff"}
        />
      ) : (
        <Text style={textStyle}>{children}</Text>
      )}
    </TouchableOpacity>
  );
}
