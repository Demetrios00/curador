/**
 * As cinco intenções que o Agente Orquestrador reconhece nesta fase.
 * UNKNOWN é o fallback seguro — nunca inventamos uma sexta categoria aqui.
 */
export const INTENTS = [
  "APPOINTMENTS",
  "INSTRUCTIONS",
  "RESULTS",
  "UNITS",
  "UNKNOWN",
] as const;

export type Intent = (typeof INTENTS)[number];

export interface IntentClassification {
  intent: Intent;
  confidence: number;
}

export function isValidIntent(value: unknown): value is Intent {
  return typeof value === "string" && (INTENTS as readonly string[]).includes(value);
}
