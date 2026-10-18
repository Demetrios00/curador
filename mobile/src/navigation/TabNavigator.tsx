import { useState } from "react";
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
import { AppMenuModal } from "@/components/AppMenuModal";
import { useTheme } from "@/contexts/ThemeContext";
import type { ReferralPrefill, AppointmentPrefill } from "@/types";

export type TabParamList = {
  Início: undefined;
  // Ideia 3 (claude/avaliacao-evolucao-pre-fase8.md): "Agendar" é a própria
  // tela NovoAgendamento (sem stack própria) — aceitar `prefill` aqui permite
  // navegar direto de "Encaminhamentos" (outra aba) com tipo/especialidade
  // já preenchidos.
  // Ideia 5 (claude/avaliacao-ajustes-2.0.md): também aceita `AppointmentPrefill`,
  // vindo de "Agendamentos" ao remarcar um agendamento cancelado.
  Agendar: { prefill?: ReferralPrefill | AppointmentPrefill } | undefined;
  "Agente IA": undefined;
  Resultados: undefined;
  Menu: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const PRIMARY = "#1aaa86";

export function TabNavigator() {
  // Ideia 1 (claude/avaliacao-evolucao-pre-fase8.md): estado do painel
  // lateral de "Menu", controlado aqui e não dentro do próprio painel, para
  // que o `listeners.tabPress` do Tab.Screen "Menu" (abaixo) possa abri-lo.
  const [menuOpen, setMenuOpen] = useState(false);
  const { colors } = useTheme();

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: PRIMARY,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
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
          listeners={{
            // ANTES: tocar em "Menu" navegava direto para MenuNavigator
            // (Perfil, primeira rota da stack). DEPOIS: `preventDefault()`
            // cancela essa navegação e abre o painel lateral no lugar.
            // Navegações programáticas para "Menu" vindas de OUTRAS telas
            // (ex.: atalho "Perfil" na Home) não passam por este listener —
            // continuam funcionando exatamente como antes.
            tabPress: (e) => {
              e.preventDefault();
              setMenuOpen(true);
            },
          }}
        />
      </Tab.Navigator>
      <AppMenuModal visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
