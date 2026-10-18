import React from "react";
import { View, Text, type ViewStyle } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Ideia 2: `default`/`secondary`/`destructive`/`success`/`warning` usam
 * pares de cor fixos (marca ou status semântico) — não dependem do tema.
 * Só `outline` (borda + texto neutros, sem preenchimento) precisa mudar
 * entre os temas, por isso é resolvida dentro do componente via `useTheme()`.
 */
const variantStyles: Record<Exclude<BadgeVariant, "outline">, { container: ViewStyle; text: { color: string } }> = {
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
  const { colors } = useTheme();
  const { container, text } =
    variant === "outline"
      ? { container: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.borderInput }, text: { color: colors.text } }
      : variantStyles[variant];
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
