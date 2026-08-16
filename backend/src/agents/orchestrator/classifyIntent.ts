import { llmProvider } from "../../llm";
import { INTENTS, isValidIntent, type IntentClassification } from "./types";

const INTENT_CLASSIFIER_PROMPT = `Você é o classificador de intenção do Agente Orquestrador do CuraDor, um app de saúde.
Sua única tarefa é identificar a qual domínio pertence a mensagem do usuário, entre EXATAMENTE estas cinco categorias:

- APPOINTMENTS: agendamentos, consultas, exames marcados, horários, próximos compromissos.
- INSTRUCTIONS: preparo para exames, orientações de procedimentos, jejum, recomendações operacionais.
- RESULTS: resultados de exames, laudos, se já ficaram prontos, status de exames realizados.
- UNITS: unidades de saúde, hospitais, localização, unidade mais próxima.
- UNKNOWN: qualquer mensagem que não se encaixe claramente em nenhuma categoria acima.

Responda SOMENTE com um JSON válido, sem nenhum texto antes ou depois, no formato exato:
{"intent": "<uma das cinco categorias>", "confidence": <número entre 0 e 1>}`;

/**
 * Classifica a intenção de uma mensagem do usuário. Não executa nenhuma
 * ação de domínio — apenas decide "quem deveria atender isso" (Fase 4 em
 * diante conecta cada intenção a um agente especializado real).
 *
 * Em caso de resposta inesperada da LLM (JSON inválido, intenção fora da
 * lista), cai em UNKNOWN com confiança 0 — nunca lança erro para o
 * chamador por uma falha de classificação; roteamento "impreciso" é
 * esperado e tratável, diferente de uma falha de infraestrutura.
 */
export async function classifyIntent(message: string): Promise<IntentClassification> {
  const raw = await llmProvider.complete([
    { role: "system", content: INTENT_CLASSIFIER_PROMPT },
    { role: "user", content: message },
  ]);

  return parseClassification(raw);
}

function parseClassification(raw: string): IntentClassification {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as {
      intent?: unknown;
      confidence?: unknown;
    };

    const intent = isValidIntent(parsed.intent) ? parsed.intent : "UNKNOWN";
    const confidence =
      typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
        ? parsed.confidence
        : 0;

    return { intent, confidence };
  } catch {
    return { intent: "UNKNOWN", confidence: 0 };
  }
}

export { INTENTS };
