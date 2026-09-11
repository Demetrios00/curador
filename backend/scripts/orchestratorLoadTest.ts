import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Roteiro de carga controlado do Agente Orquestrador (Fase 7 — evidências
 * para o TCC 2, Seção 15 do projeto: "taxa de roteamento correto",
 * "latência por etapa", "taxa de execução bem-sucedida").
 *
 * Diferença deliberada em relação a um teste de carga tradicional: aqui o
 * objetivo não é medir capacidade sob concorrência, e sim gerar uma
 * amostra QUANTITATIVA (várias repetições por cenário) sem abrir mão da
 * garantia QUALITATIVA de cada caso — cada chamada é comparada contra o
 * resultado ESPERADO (intenção e agente exatos), não só contabilizada.
 * Isso é o que permite falar em "consistência do roteamento" no TCC 2,
 * e não apenas em "taxa de sucesso HTTP".
 *
 * Pré-requisitos (nunca commitados — ver .env.example):
 *   LOADTEST_PATIENT_EMAIL / LOADTEST_PATIENT_PASSWORD — conta de paciente
 *   de teste já existente no Firebase Authentication deste projeto.
 *   FIREBASE_WEB_API_KEY — chave pública do Firebase Web (a mesma usada no
 *   app mobile, `firebase.ts`; não é segredo de servidor, identifica o
 *   projeto, não autoriza nada por si só — a autorização real é o Firestore
 *   Rules + a verificação do ID token pelo backend, `middleware/auth.ts`).
 *
 * Uso:
 *   npm run loadtest:orchestrator
 *   npm run loadtest:orchestrator -- --repeats=5 --delayMs=800
 *
 * Saída:
 *   - relatório no console (por caso + agregado);
 *   - JSON completo em tests/reports/orchestratorLoadTest-<timestamp>.json.
 */

const BASE_URL = process.env.LOADTEST_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3333}`;
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY ?? "";
const PATIENT_EMAIL = process.env.LOADTEST_PATIENT_EMAIL ?? "";
const PATIENT_PASSWORD = process.env.LOADTEST_PATIENT_PASSWORD ?? "";

type ExpectedAgent = "appointments" | "instructions" | "results" | "units" | null;

interface TestCase {
  id: string;
  message: string;
  expectedIntent: string;
  expectedAgent: ExpectedAgent;
  /** Só o caso de UNITS precisa de localização para exercitar o fluxo completo. */
  location?: { latitude: number; longitude: number };
}

/**
 * Roteiro fixo (Seção 9 do projeto — exemplos oficiais de cada domínio),
 * mais dois casos de borda para não medir só o "caminho feliz":
 * ambiguidade proposital (esperado UNKNOWN) e mensagem fora do domínio de
 * saúde (também esperado UNKNOWN). Fixo e versionado para que a mesma
 * bateria possa ser repetida de forma idêntica em rodadas futuras.
 */
const TEST_CASES: TestCase[] = [
  { id: "APPOINTMENTS-1", message: "Quais consultas tenho esta semana?", expectedIntent: "APPOINTMENTS", expectedAgent: "appointments" },
  { id: "INSTRUCTIONS-1", message: "Preciso ficar em jejum para meu exame?", expectedIntent: "INSTRUCTIONS", expectedAgent: "instructions" },
  { id: "RESULTS-1", message: "Meu hemograma já ficou pronto?", expectedIntent: "RESULTS", expectedAgent: "results" },
  {
    id: "UNITS-1",
    message: "Qual unidade fica mais perto de mim?",
    expectedIntent: "UNITS",
    expectedAgent: "units",
    location: { latitude: -25.7434, longitude: -53.0631 }, // Dois Vizinhos - PR (UTFPR), só para exercitar o fluxo
  },
  { id: "EDGE-AMBIGUOUS", message: "Oi, tudo bem?", expectedIntent: "UNKNOWN", expectedAgent: null },
  { id: "EDGE-OFFTOPIC", message: "Qual é a capital da França?", expectedIntent: "UNKNOWN", expectedAgent: null },
];

interface CaseResult {
  caseId: string;
  message: string;
  expectedIntent: string;
  expectedAgent: ExpectedAgent;
  attempt: number;
  httpStatus: number | null;
  actualIntent: string | null;
  actualAgent: string | null;
  toolUsed: string | null;
  latencyMs: number;
  requestSucceeded: boolean;
  intentMatches: boolean;
  agentMatches: boolean;
  pass: boolean;
  errorMessage: string | null;
}

function parseArg(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  if (!found) return fallback;
  const value = Number(found.slice(prefix.length));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertConfig(): void {
  const missing: string[] = [];
  if (!FIREBASE_WEB_API_KEY) missing.push("FIREBASE_WEB_API_KEY");
  if (!PATIENT_EMAIL) missing.push("LOADTEST_PATIENT_EMAIL");
  if (!PATIENT_PASSWORD) missing.push("LOADTEST_PATIENT_PASSWORD");

  if (missing.length > 0) {
    console.error(
      `[loadtest] Variáveis ausentes no .env: ${missing.join(", ")}.\n` +
        "Veja .env.example — nunca commite a senha da conta de teste."
    );
    process.exit(1);
  }
}

/**
 * Autentica a conta de paciente de teste via Firebase Auth REST API e
 * devolve o ID token — o mesmo tipo de token que `middleware/auth.ts`
 * espera no header `Authorization: Bearer <token>` (é o que o app mobile
 * já faz com `user.getIdToken()`, aqui reproduzido fora do app).
 */
async function signInTestPatient(): Promise<string> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: PATIENT_EMAIL, password: PATIENT_PASSWORD, returnSecureToken: true }),
  });

  const body = (await response.json()) as { idToken?: string; error?: { message?: string } };

  if (!response.ok || !body.idToken) {
    throw new Error(
      `Falha ao autenticar conta de teste (${response.status}): ${body.error?.message ?? "resposta sem idToken"}`
    );
  }

  return body.idToken;
}

async function runOneCase(testCase: TestCase, attempt: number, idToken: string): Promise<CaseResult> {
  const startedAt = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/api/orchestrator/route`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        message: testCase.message,
        ...(testCase.location ? { location: testCase.location } : {}),
      }),
    });

    const latencyMs = Date.now() - startedAt;
    const payload = (await response.json()) as {
      intent?: string;
      agent?: string | null;
      result?: unknown;
      error?: { message?: string; code?: string };
    };

    if (!response.ok) {
      return {
        caseId: testCase.id,
        message: testCase.message,
        expectedIntent: testCase.expectedIntent,
        expectedAgent: testCase.expectedAgent,
        attempt,
        httpStatus: response.status,
        actualIntent: null,
        actualAgent: null,
        toolUsed: null,
        latencyMs,
        requestSucceeded: false,
        intentMatches: false,
        agentMatches: false,
        pass: false,
        errorMessage: payload.error?.message ?? `HTTP ${response.status}`,
      };
    }

    const actualIntent = payload.intent ?? null;
    const actualAgent = payload.agent ?? null;
    const intentMatches = actualIntent === testCase.expectedIntent;
    const agentMatches = actualAgent === testCase.expectedAgent;

    return {
      caseId: testCase.id,
      message: testCase.message,
      expectedIntent: testCase.expectedIntent,
      expectedAgent: testCase.expectedAgent,
      attempt,
      httpStatus: response.status,
      actualIntent,
      actualAgent,
      toolUsed: null,
      latencyMs,
      requestSucceeded: true,
      intentMatches,
      agentMatches,
      pass: intentMatches && agentMatches,
      errorMessage: null,
    };
  } catch (err) {
    return {
      caseId: testCase.id,
      message: testCase.message,
      expectedIntent: testCase.expectedIntent,
      expectedAgent: testCase.expectedAgent,
      attempt,
      httpStatus: null,
      actualIntent: null,
      actualAgent: null,
      toolUsed: null,
      latencyMs: Date.now() - startedAt,
      requestSucceeded: false,
      intentMatches: false,
      agentMatches: false,
      pass: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

function printReport(results: CaseResult[]): void {
  console.log("\n=== Resultado por chamada ===");
  for (const r of results) {
    const status = r.pass ? "PASS" : "FAIL";
    console.log(
      `[${status}] ${r.caseId} (tentativa ${r.attempt}) — esperado=${r.expectedIntent}/${r.expectedAgent ?? "—"} ` +
        `obtido=${r.actualIntent ?? "—"}/${r.actualAgent ?? "—"} — ${r.latencyMs}ms` +
        (r.errorMessage ? ` — erro: ${r.errorMessage}` : "")
    );
  }

  const total = results.length;
  const httpSuccess = results.filter((r) => r.requestSucceeded);
  const httpErrors = total - httpSuccess.length;
  const routingMatches = httpSuccess.filter((r) => r.pass).length;
  const routingAccuracy = httpSuccess.length > 0 ? routingMatches / httpSuccess.length : null;
  const avgLatencyMs = total > 0 ? Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / total) : 0;

  console.log("\n=== Agregado geral ===");
  console.log(`Total de chamadas: ${total}`);
  console.log(`Sucesso HTTP: ${httpSuccess.length} | Erros HTTP/rede: ${httpErrors}`);
  console.log(
    `Roteamento correto (entre as bem-sucedidas): ${routingMatches}/${httpSuccess.length}` +
      (routingAccuracy !== null ? ` (${(routingAccuracy * 100).toFixed(1)}%)` : "")
  );
  console.log(`Latência média (todas as chamadas, incl. falhas): ${avgLatencyMs}ms`);

  console.log("\n=== Agregado por cenário ===");
  const byCase = new Map<string, CaseResult[]>();
  for (const r of results) {
    byCase.set(r.caseId, [...(byCase.get(r.caseId) ?? []), r]);
  }
  for (const [caseId, caseResults] of byCase) {
    const passCount = caseResults.filter((r) => r.pass).length;
    const avg = Math.round(caseResults.reduce((s, r) => s + r.latencyMs, 0) / caseResults.length);
    console.log(`${caseId}: ${passCount}/${caseResults.length} PASS — latência média ${avg}ms`);
  }

  if (httpErrors > 0) {
    console.log(
      "\n[loadtest] Atenção: houve falha(s) HTTP/rede — isso é exatamente a situação de " +
        '"falhas antes da classificação" registrada em claude/roteiro-testes-2.0-lote1-e-ideia5.md. ' +
        "Verifique o console do backend (`npm run dev`) no momento de cada falha listada acima."
    );
  }
}

function saveReport(results: CaseResult[]): string {
  const reportsDir = join(__dirname, "..", "tests", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const fileName = `orchestratorLoadTest-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const filePath = join(reportsDir, fileName);
  writeFileSync(filePath, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: BASE_URL, results }, null, 2));
  return filePath;
}

async function main(): Promise<void> {
  assertConfig();

  const repeats = parseArg("repeats", 3);
  const delayMs = parseArg("delayMs", 500);

  console.log(`[loadtest] Autenticando conta de teste (${PATIENT_EMAIL})...`);
  const idToken = await signInTestPatient();
  console.log(`[loadtest] Autenticado. Executando ${TEST_CASES.length} cenários x ${repeats} repetições = ${TEST_CASES.length * repeats} chamadas contra ${BASE_URL}...`);

  const results: CaseResult[] = [];
  for (const testCase of TEST_CASES) {
    for (let attempt = 1; attempt <= repeats; attempt++) {
      const result = await runOneCase(testCase, attempt, idToken);
      results.push(result);
      await sleep(delayMs);
    }
  }

  printReport(results);
  const filePath = saveReport(results);
  console.log(`\n[loadtest] Relatório completo salvo em: ${filePath}`);
}

main().catch((err) => {
  console.error("[loadtest] Erro fatal:", err);
  process.exit(1);
});
