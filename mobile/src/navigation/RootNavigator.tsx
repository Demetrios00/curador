import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { AuthNavigator } from "./AuthNavigator";
import { TabNavigator } from "./TabNavigator";

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#1aaa86" />
      </View>
    );
  }

  return user ? <TabNavigator /> : <AuthNavigator />;
}
