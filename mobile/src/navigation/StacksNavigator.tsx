import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "@/screens/Home";
import AgendamentosScreen from "@/screens/Agendamentos";
import NovoAgendamentoScreen from "@/screens/NovoAgendamento";
import ResultadosScreen from "@/screens/Resultados";
import PrescricoesScreen from "@/screens/Prescricoes";
import EncaminhamentosScreen from "@/screens/Encaminhamentos";
import PerfilScreen from "@/screens/Perfil";
import UnidadesProximasScreen from "@/screens/UnidadesProximas";
import AgenteIAScreen from "@/screens/AgenteIA";
import type { ReferralPrefill, AppointmentPrefill } from "@/types";

// ── Param lists ──────────────────────────────────────────────────────────────

export type HomeStackParamList = {
  Home: undefined;
  Agendamentos: undefined;
};

export type AgendamentosStackParamList = {
  Agendamentos: undefined;
  // Ideia 3 (claude/avaliacao-evolucao-pre-fase8.md): aceita um prefill opcional
  // vindo de "Encaminhamentos", pelo mesmo caminho usado pela aba "Agendar".
  // Ideia 5 (claude/avaliacao-ajustes-2.0.md): também aceita `AppointmentPrefill`,
  // vindo do próprio `Agendamentos.tsx` ao remarcar um agendamento cancelado.
  NovoAgendamento: { prefill?: ReferralPrefill | AppointmentPrefill } | undefined;
};

export type ResultadosStackParamList = {
  Resultados: undefined;
  Prescricoes: undefined;
  Encaminhamentos: undefined;
};

export type MenuStackParamList = {
  Perfil: undefined;
  UnidadesProximas: undefined;
};

export type AgenteIAStackParamList = {
  AgenteIA: undefined;
};

// ── Stacks ───────────────────────────────────────────────────────────────────

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
export function HomeNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Home" component={HomeScreen} />
      <HomeStack.Screen name="Agendamentos" component={AgendamentosScreen} />
    </HomeStack.Navigator>
  );
}

const AgendamentosStack = createNativeStackNavigator<AgendamentosStackParamList>();
export function AgendamentosNavigator() {
  return (
    <AgendamentosStack.Navigator screenOptions={{ headerShown: false }}>
      <AgendamentosStack.Screen name="Agendamentos" component={AgendamentosScreen} />
      <AgendamentosStack.Screen name="NovoAgendamento" component={NovoAgendamentoScreen} />
    </AgendamentosStack.Navigator>
  );
}

const ResultadosStack = createNativeStackNavigator<ResultadosStackParamList>();
export function ResultadosNavigator() {
  return (
    <ResultadosStack.Navigator screenOptions={{ headerShown: false }}>
      <ResultadosStack.Screen name="Resultados" component={ResultadosScreen} />
      <ResultadosStack.Screen name="Prescricoes" component={PrescricoesScreen} />
      <ResultadosStack.Screen name="Encaminhamentos" component={EncaminhamentosScreen} />
    </ResultadosStack.Navigator>
  );
}

const MenuStack = createNativeStackNavigator<MenuStackParamList>();
export function MenuNavigator() {
  return (
    <MenuStack.Navigator screenOptions={{ headerShown: false }}>
      <MenuStack.Screen name="Perfil" component={PerfilScreen} />
      <MenuStack.Screen name="UnidadesProximas" component={UnidadesProximasScreen} />
    </MenuStack.Navigator>
  );
}

// Direct screen (no nested stack needed)
export { NovoAgendamentoScreen };

const AgenteIAStack = createNativeStackNavigator<AgenteIAStackParamList>();
export function AgenteIANavigator() {
  return (
    <AgenteIAStack.Navigator screenOptions={{ headerShown: false }}>
      <AgenteIAStack.Screen name="AgenteIA" component={AgenteIAScreen} />
    </AgenteIAStack.Navigator>
  );
}
