import "dotenv/config";

/**
 * Configuração central de variáveis de ambiente.
 *
 * Cada variável nova adicionada em fases seguintes (Firebase Admin, LLM,
 * etc.) deve ser declarada aqui, nunca lida via `process.env` espalhado
 * pelo restante do código — isso mantém uma única fonte de verdade e
 * facilita detectar configuração ausente cedo (fail-fast).
 */

interface EnvConfig {
  nodeEnv: "development" | "production" | "test";
  port: number;
  /** Chave da LLM (OpenRouter). Vazia = endpoint /api/chat retorna erro 500 controlado. */
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;
  /** Modelos alternativos (separados por vírgula), usados pela OpenRouter como fallback automático em erro/limite do modelo principal. */
  llmFallbackModels: string[];
  /** Limite de tempo de cada chamada ao LLM, incluindo a leitura da resposta (ms). */
  llmTimeoutMs: number;
  /** Máximo de modelos tentados por chamada (principal + alternativos). */
  llmMaxAttempts: number;
  /** Limite de tokens gerados por chamada (respostas do CuraDor são curtas). */
  llmMaxTokens: number;
  /** Desliga o "raciocínio" estendido dos modelos que o suportam (reduz latência). */
  llmDisableReasoning: boolean;
  /** Credenciais do service account do Firebase Admin. Vazias = rotas que dependem do Firestore retornam erro 500 controlado. */
  firebaseProjectId: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
}

function readEnv(): EnvConfig {
  const port = Number(process.env.PORT ?? 3333);

  if (Number.isNaN(port)) {
    throw new Error(`Variável de ambiente PORT inválida: "${process.env.PORT}"`);
  }

  const nodeEnv = (process.env.NODE_ENV ?? "development") as EnvConfig["nodeEnv"];

  return {
    nodeEnv,
    port,
    llmApiKey: process.env.LLM_API_KEY ?? "",
    llmBaseUrl: process.env.LLM_BASE_URL ?? "https://openrouter.ai/api/v1",
    llmModel: process.env.LLM_MODEL ?? "nvidia/nemotron-3.5-lightning:free",
    llmFallbackModels: (process.env.LLM_FALLBACK_MODELS ?? "")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 18000),
    llmMaxAttempts: Number(process.env.LLM_MAX_ATTEMPTS ?? 2),
    llmMaxTokens: Number(process.env.LLM_MAX_TOKENS ?? 1024),
    llmDisableReasoning: (process.env.LLM_DISABLE_REASONING ?? "true") !== "false",
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "",
    firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "",
    // Chaves privadas em .env costumam vir com "\n" escapado — convertemos para quebra de linha real.
    firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  };
}

export const env = readEnv();
