import React from "react";
import { View, Text, type ViewProps } from "react-native";

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
  return (
    <View
      style={[
        {
          backgroundColor: "#ffffff",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#e5e7eb",
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
  return (
    <Text style={{ fontSize: 18, fontWeight: "600", color: "#111827", lineHeight: 22 }}>
      {children}
    </Text>
  );
}

export function CardDescription({ children }: CardDescriptionProps) {
  return (
    <Text style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{children}</Text>
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
