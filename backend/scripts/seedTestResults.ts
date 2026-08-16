import "dotenv/config";

import { getAdminAuth, getAdminFirestore } from "../src/firebase/admin";

/**
 * Cria dois resultados de exame de teste para um paciente real — 1
 * "disponivel" (com laudo) e 1 "processando" — para validar o Agente de
 * Resultados de ponta a ponta.
 *
 * Segue exatamente o schema real da coleção `results` (`types/index.ts` e
 * `Resultados.tsx` do app mobile) — não inventa campos novos.
 *
 * Uso:
 *   npm run seed:test-results -- --email=paciente@exemplo.com
 *
 * Se `--email` não for informado, usa a variável de ambiente
 * SEED_PATIENT_EMAIL (opcional, definida no .env só para rodar este script).
 */
function getEmailArg(): string {
  const arg = process.argv.find((a) => a.startsWith("--email="));
  const email = arg?.split("=")[1] ?? process.env.SEED_PATIENT_EMAIL;

  if (!email) {
    throw new Error('Informe o e-mail do paciente de teste: npm run seed:test-results -- --email=paciente@exemplo.com');
  }

  return email;
}

async function main() {
  const email = getEmailArg();
  const db = getAdminFirestore();
  const auth = getAdminAuth();

  const user = await auth.getUserByEmail(email);
  const patientUid = user.uid;
  console.log(`[seed:test-results] paciente encontrado: ${email} (uid=${patientUid})`);

  const hospitalsSnap = await db.collection("hospitals").limit(1).get();
  if (hospitalsSnap.empty) {
    throw new Error("Nenhum hospital cadastrado em `hospitals` — não é possível criar resultados de teste.");
  }
  const hospital = hospitalsSnap.docs[0];
  const hospitalName = hospital.data().name as string;

  // Reaproveita nomes reais de examTypes já cadastrados, quando existirem,
  // em vez de inventar nomes de exame — mesmo princípio do
  // `seed:instructions`/`seed:test-appointments`.
  const examTypesSnap = await db.collection("examTypes").limit(2).get();
  const examTitles = examTypesSnap.docs.map((d) => d.data().name as string);

  const availableTitle = examTitles[0] ?? "Hemograma completo";
  const processingTitle = examTitles[1] ?? examTitles[0] ?? "Ressonância Magnética";

  const baseResult = {
    patientUid,
    type: "exame" as const,
    hospitalName,
  };

  const availableRef = await db.collection("results").add({
    ...baseResult,
    title: availableTitle,
    date: "2026-08-10T09:00:00.000Z",
    status: "disponivel",
    fileURL: "https://example.com/laudos/laudo-teste.pdf",
  });

  const processingRef = await db.collection("results").add({
    ...baseResult,
    title: processingTitle,
    date: "2026-08-14T09:00:00.000Z",
    status: "processando",
  });

  console.log(`[seed:test-results] resultado disponível criado: "${availableTitle}" (id=${availableRef.id})`);
  console.log(`[seed:test-results] resultado em processamento criado: "${processingTitle}" (id=${processingRef.id})`);
  console.log("[seed:test-results] concluído.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed:test-results] falha:", err instanceof Error ? err.message : err);
  process.exit(1);
});
