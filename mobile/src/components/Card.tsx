import React from "react";
import { View, Text, type ViewProps } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface CardProps extends ViewProps {
  children: React.ReactNode;
}

interface CardHeaderProps extends ViewProps {
  children: React.ReactNode;
}

interface CardTitleProps {
  children: React.ReactNode;
}

interface CardDescriptionProps {
  children: React.ReactNode;
}

interface CardContentProps extends ViewProps {
  children: React.ReactNode;
}

interface CardFooterProps extends ViewProps {
  children: React.ReactNode;
}

export function Card({ children, style, ...props }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

export function CardHeader({ children, style, ...props }: CardHeaderProps) {
  return (
    <View style={[{ padding: 16, paddingBottom: 8 }, style]} {...props}>
      {children}
    </View>
  );
}

export function CardTitle({ children }: CardTitleProps) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 18, fontWeight: "600", color: colors.text, lineHeight: 22 }}>
      {children}
    </Text>
  );
}

export function CardDescription({ children }: CardDescriptionProps) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{children}</Text>
  );
}

export function CardContent({ children, style, ...props }: CardContentProps) {
  return (
    <View style={[{ padding: 16, paddingTop: 0 }, style]} {...props}>
      {children}
    </View>
  );
}

export function CardFooter({ children, style, ...props }: CardFooterProps) {
  return (
    <View
      style={[{ padding: 16, paddingTop: 0, flexDirection: "row", alignItems: "center" }, style]}
      {...props}
    >
      {children}
    </View>
  );
}
