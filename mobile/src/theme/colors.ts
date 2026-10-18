/**
 * Ideia 2 (claude/ideia2-tema-dark-light-proposta.md): paleta de cores do
 * app, com uma variante para cada tema (`light`/`dark`).
 *
 * Cores de marca e de status (`primary`, `secondary`, `danger`, `warn`) são
 * CONSTANTES entre os dois temas — só as cores neutras (fundo, superfície,
 * texto, borda) mudam. Isso mantém a identidade visual do CuraDor igual em
 * ambos os temas e reduz a superfície de mudança: nenhum componente que só
 * usa cor de marca precisa ser tocado (ex.: `Button.tsx`).
 */
export interface ThemePalette {
  /** Fundo padrão das telas (ex.: `ScrollView` raiz). */
  background: string;
  /** Fundo de cards e superfícies elevadas (ex.: `Card`, `PageHeader`). */
  surface: string;
  /** Fundo de superfícies secundárias (ex.: trilho do `Tabs`, ícones de linha). */
  surfaceAlt: string;
  /** Texto principal (títulos, valores). */
  text: string;
  /** Texto secundário (legendas, rótulos). */
  textMuted: string;
  /** Texto terciário (placeholders, ícones neutros). */
  textSubtle: string;
  /** Borda padrão (divisores, contorno de card). */
  border: string;
  /** Borda de campos de formulário. */
  borderInput: string;
  /** Cor de placeholder de `TextInput`. */
  placeholder: string;
  /** Overlay de modais (fundo escurecido atrás de painéis). */
  overlay: string;

  /** Cor de marca — constante entre os temas. */
  primary: string;
  /** Cor de marca secundária — constante entre os temas. */
  secondary: string;
  /** Cor de erro/perigo — constante entre os temas. */
  danger: string;
  /** Cor de alerta/aviso — constante entre os temas. */
  warn: string;
}

export const lightColors: ThemePalette = {
  background: "#f9fafb",
  surface: "#ffffff",
  surfaceAlt: "#f3f4f6",
  text: "#111827",
  textMuted: "#6b7280",
  textSubtle: "#9ca3af",
  border: "#e5e7eb",
  borderInput: "#d1d5db",
  placeholder: "#9ca3af",
  overlay: "rgba(0,0,0,0.4)",

  primary: "#1aaa86",
  secondary: "#0e5e70",
  danger: "#ef4444",
  warn: "#f59e0b",
};

export const darkColors: ThemePalette = {
  background: "#0d1117",
  surface: "#161b22",
  surfaceAlt: "#1f2630",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  textSubtle: "#6b7280",
  border: "#2d333d",
  borderInput: "#3a414d",
  placeholder: "#6b7280",
  overlay: "rgba(0,0,0,0.6)",

  primary: "#1aaa86",
  secondary: "#0e5e70",
  danger: "#ef4444",
  warn: "#f59e0b",
};
