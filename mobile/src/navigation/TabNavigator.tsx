import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, Calendar, Bot, FileText, Menu } from "lucide-react-native";
import {
  HomeNavigator,
  AgendamentosNavigator,
  ResultadosNavigator,
  MenuNavigator,
  AgenteIANavigator,
  NovoAgendamentoScreen,
} from "./StacksNavigator";

export type TabParamList = {
  Início: undefined;
  Agendar: undefined;
  "Agente IA": undefined;
  Resultados: undefined;
  Menu: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const PRIMARY = "#1aaa86";

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          backgroundColor: "#ffffff",
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tab.Screen
        name="Início"
        component={HomeNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Agendar"
        component={NovoAgendamentoScreen}
        options={{ tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Agente IA"
        component={AgenteIANavigator}
        options={{ tabBarIcon: ({ color, size }) => <Bot color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Resultados"
        component={ResultadosNavigator}
        options={{ tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Menu"
        component={MenuNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Menu color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
