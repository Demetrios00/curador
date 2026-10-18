import "dotenv/config";

/**
 * Sonda de latência dos modelos de LLM (18/10/2026).
 *
 * Envia o MESMO prompt curto de classificação de intenção a cada modelo
 * candidato e mede o tempo de resposta, para escolher o LLM_MODEL (e os
 * LLM_FALLBACK_MODELS) com base em evidência, não em suposição.
 *
 * Uso:  npm run llm:probe
 *       npm run llm:probe -- modeloA:free modeloB:free   (lista própria)
 *
 * Lê LLM_API_KEY e LLM_BASE_URL do .env. Nada é gravado no Firestore.
 */
const DEFAULT_CANDIDATES = [
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "liquid/lfm-2.5-2.6b:free",
  "thinkingmachines/inkling-small:free",
  "poolside/laguna-xs-2.1:free",
  "xingchen-agi/xing4.0-29b-a4b:free",
];

const PROMPT = [
  {
    role: "system",
    content:
      'Classifique a mensagem em APPOINTMENTS, INSTRUCTIONS, RESULTS, UNITS ou UNKNOWN. Responda só JSON: {"intent":"...","confidence":0.0}',
  },
  { role: "user", content: "Quais consultas eu tenho esta semana?" },
];

async function probe(model: string): Promise<void> {
  const started = Date.now();
  try {
    const res = await fetch(`${process.env.LLM_BASE_URL ?? "https://openrouter.ai/api/v1"}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: PROMPT, max_tokens: 200, reasoning: { enabled: false } }),
      signal: AbortSignal.timeout(40_000),
    });
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; error?: { message?: string } };
    const ms = Date.now() - started;
    const out = body.choices?.[0]?.message?.content?.replace(/\s+/g, " ").slice(0, 80) ?? `ERRO: ${body.error?.message ?? res.status}`;
    console.log(`${res.ok ? "OK  " : "FALHA"} ${String(ms).padStart(6)} ms  ${model}  ->  ${out}`);
  } catch (err) {
    console.log(`FALHA ${String(Date.now() - started).padStart(6)} ms  ${model}  ->  ${(err as Error).name}: ${(err as Error).message}`);
  }
}

async function main(): Promise<void> {
  if (!process.env.LLM_API_KEY) {
    console.error("LLM_API_KEY ausente no .env");
    process.exit(1);
  }
  const models = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_CANDIDATES;
  console.log(`Sondando ${models.length} modelos (sequencial, timeout 40s cada)...\n`);
  for (const m of models) await probe(m);
}

void main();
