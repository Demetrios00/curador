import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkColors, lightColors, type ThemePalette } from "@/theme/colors";

export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  /** Tema atualmente aplicado (já resolvido — nunca "system"). */
  mode: ThemeMode;
  /** Paleta de cores correspondente a `mode`. */
  colors: ThemePalette;
  /** Alterna entre claro e escuro e persiste a escolha. */
  toggleTheme: () => void;
  /** Define o tema explicitamente (usado pelo switch em Perfil). */
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = "@curador/theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Ideia 2 (claude/ideia2-tema-dark-light-proposta.md), escopo reduzido
 * (Opção A): infraestrutura completa de tema (Context + persistência +
 * alternância funcional), aplicada de forma demonstrável em Home + Perfil +
 * componentes compartilhados.
 *
 * Mesmo padrão já usado no projeto para `AuthContext`/`useAuth()`
 * (`src/contexts/AuthContext.tsx`): Provider + hook dedicado, sem biblioteca
 * de gerenciamento de estado nova.
 *
 * Prioridade de resolução do tema:
 * 1. Escolha manual persistida em `AsyncStorage` (chave `@curador/theme`),
 *    se existir — sobrevive a reabrir o app.
 * 2. Tema do sistema operacional (`useColorScheme()`), na primeira
 *    abertura ou se a escolha manual for limpa.
 * 3. `"light"`, se nenhum dos dois estiver disponível (fallback seguro).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(systemScheme === "dark" ? "dark" : "light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") {
          setModeState(stored);
        } else if (systemScheme === "dark" || systemScheme === "light") {
          setModeState(systemScheme);
        }
      } catch (e) {
        console.log("[ThemeContext] Erro ao ler tema salvo:", e);
      } finally {
        setHydrated(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  const persist = async (next: ThemeMode) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      console.log("[ThemeContext] Erro ao salvar tema:", e);
    }
  };

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    persist(next);
  };

  const toggleTheme = () => {
    setMode(mode === "light" ? "dark" : "light");
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === "dark" ? darkColors : lightColors,
      toggleTheme,
      setMode,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode]
  );

  // Evita um "flash" do tema errado (system → salvo) durante a hidratação:
  // como a leitura do AsyncStorage é assíncrona, `hydrated` só existe para
  // documentar essa janela — não bloqueia a renderização (a tela de loading
  // do RootNavigator já cobre esse instante inicial na prática).
  void hydrated;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme deve estar dentro de <ThemeProvider>");
  return ctx;
};
