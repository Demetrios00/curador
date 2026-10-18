import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import {
  Bot,
  Calendar,
  FileText,
  Home,
  MapPin,
  Pill,
  Send,
  User,
  X,
} from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";

const PANEL_WIDTH = 288;
const PRIMARY = "#1aaa86";

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  /** Nome da aba (Tab) de destino. */
  tab: string;
  /** Tela dentro da stack da aba, quando não for a tela padrão dela. */
  screen?: string;
}

/**
 * Ideia 1 (claude/avaliacao-evolucao-pre-fase8.md): itens em ordem
 * alfabética ascendente, conforme solicitado. Cada item navega via
 * `navigation.navigate(tab, { screen })` — mesmo padrão de navegação
 * cross-tab já usado em `Home.tsx` (`goToTab`) e `Encaminhamentos.tsx`.
 */
const MENU_ITEMS: MenuItem[] = [
  { label: "Agendar", icon: Calendar, tab: "Agendar" },
  { label: "Agente IA", icon: Bot, tab: "Agente IA" },
  { label: "Encaminhamentos", icon: Send, tab: "Resultados", screen: "Encaminhamentos" },
  { label: "Início", icon: Home, tab: "Início" },
  { label: "Perfil", icon: User, tab: "Menu", screen: "Perfil" },
  { label: "Prescrições", icon: Pill, tab: "Resultados", screen: "Prescricoes" },
  { label: "Resultados", icon: FileText, tab: "Resultados" },
  { label: "Unidades", icon: MapPin, tab: "Menu", screen: "UnidadesProximas" },
];

interface AppMenuModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Painel lateral do item "Menu" da tab bar (Ideia 1).
 *
 * ANTES: tocar em "Menu" navegava direto para a tela Perfil (primeira rota
 * de `MenuNavigator`), sem nenhuma lista de opções.
 * DEPOIS: tocar em "Menu" abre este painel, com todas as telas do app em
 * ordem alfabética. A interceptação do toque acontece via `listeners.tabPress`
 * no `Tab.Screen` de "Menu" (`TabNavigator.tsx`) — apenas o toque no ÍCONE da
 * tab bar é interceptado; navegar para "Menu"/Perfil a partir de outros
 * pontos do app (ex.: atalhos da Home) continua funcionando normalmente.
 *
 * Implementado com `Modal` + `Animated` (nativos do React Native) em vez de
 * `@react-navigation/drawer`, para não introduzir `react-native-gesture-handler`/
 * `react-native-reanimated` como dependências novas nem exigir rebuild nativo
 * — decisão apresentada e aprovada antes da implementação (ver
 * claude/avaliacao-evolucao-pre-fase8.md, Ideia 1).
 */
export function AppMenuModal({ visible, onClose }: AppMenuModalProps) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;
  // Mantém o Modal montado durante a animação de fechamento, para o slide
  // para fora da tela ser visível em vez de sumir instantaneamente.
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    } else if (rendered) {
      Animated.timing(slideAnim, { toValue: PANEL_WIDTH, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!rendered) return null;

  const handleNavigate = (item: MenuItem) => {
    onClose();
    if (item.screen) {
      navigation.navigate(item.tab, { screen: item.screen });
    } else {
      navigation.navigate(item.tab);
    }
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: colors.overlay }}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Fechar menu"
        />
        <Animated.View
          style={{
            width: PANEL_WIDTH,
            backgroundColor: colors.surface,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            transform: [{ translateX: slideAnim }],
            shadowColor: "#000",
            shadowOffset: { width: -2, height: 0 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 16,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>Menu</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }} accessibilityLabel="Fechar">
              <X size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingVertical: 8 }}>
            {MENU_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => handleNavigate(item)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                  }}
                  accessibilityLabel={item.label}
                >
                  <View
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: "rgba(26,170,134,0.1)",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Icon size={18} color={PRIMARY} />
                  </View>
                  <Text style={{ fontSize: 15, color: colors.text, fontWeight: "500" }}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
