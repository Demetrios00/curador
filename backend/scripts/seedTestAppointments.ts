import "dotenv/config";

import { getAdminAuth, getAdminFirestore } from "../src/firebase/admin";

/**
 * Cria dois agendamentos de teste — 1 exame (16/08) e 1 cirurgia (17/08) —
 * para um paciente real, usando um tipo de exame/cirurgia que JÁ TEM
 * instrução cadastrada em `instructions` (rode `npm run seed:instructions`
 * antes, se ainda não rodou).
 *
 * Segue exatamente o mesmo formato de escrita usado por
 * `NovoAgendamento.tsx` no app mobile — não inventa campos novos.
 *
 * Uso:
 *   npm run seed:test-appointments -- --email=paciente@exemplo.com
 *
 * Se `--email` não for informado, usa a variável de ambiente
 * SEED_PATIENT_EMAIL (opcional, definida no .env só para rodar este script).
 */
const EXAM_DATE_ISO = "2026-08-16T09:00:00.000Z";
const SURGERY_DATE_ISO = "2026-08-17T09:00:00.000Z";

function getEmailArg(): string {
  const arg = process.argv.find((a) => a.startsWith("--email="));
  const email = arg?.split("=")[1] ?? process.env.SEED_PATIENT_EMAIL;

  if (!email) {
    throw new Error(
      'Informe o e-mail do paciente de teste: npm run seed:test-appointments -- --email=paciente@exemplo.com'
    );
  }

  return email;
}

async function main() {
  const email = getEmailArg();
  const db = getAdminFirestore();
  const auth = getAdminAuth();

  const user = await auth.getUserByEmail(email);
  const patientUid = user.uid;
  console.log(`[seed:test-appointments] paciente encontrado: ${email} (uid=${patientUid})`);

  const hospitalsSnap = await db.collection("hospitals").limit(1).get();
  if (hospitalsSnap.empty) {
    throw new Error("Nenhum hospital cadastrado em `hospitals` — não é possível criar agendamentos de teste.");
  }
  const hospital = hospitalsSnap.docs[0];
  const hospitalId = hospital.id;
  const hospitalName = hospital.data().name as string;

  const instructionsSnap = await db.collection("instructions").get();
  if (instructionsSnap.empty) {
    throw new Error(
      "Nenhuma instrução cadastrada em `instructions` — rode `npm run seed:instructions` antes deste script."
    );
  }

  const examInstruction = instructionsSnap.docs.find((d) => d.data().scope === "exam" && d.data().examTypeId);
  const surgeryInstruction = instructionsSnap.docs.find((d) => d.data().scope === "surgery" && d.data().surgeryTypeId);

  if (!examInstruction || !surgeryInstruction) {
    throw new Error(
      "Não encontrei uma instrução de exame E uma de cirurgia em `instructions`. Rode `npm run seed:instructions` novamente."
    );
  }

  const examTypeDoc = await db.collection("examTypes").doc(examInstruction.data().examTypeId).get();
  const surgeryTypeDoc = await db.collection("surgeryTypes").doc(surgeryInstruction.data().surgeryTypeId).get();

  if (!examTypeDoc.exists || !surgeryTypeDoc.exists) {
    throw new Error("O examType/surgeryType referenciado pela instrução não existe mais em examTypes/surgeryTypes.");
  }

  const examTitle = examTypeDoc.data()!.name as string;
  const surgeryTitle = surgeryTypeDoc.data()!.name as string;

  const baseAppointment = {
    patientUid,
    doctorId: null,
    doctorName: null,
    specialtyId: null,
    hospitalId,
    hospitalName,
    status: "agendado",
    notes: null,
    createdAt: Date.now(),
  };

  const examRef = await db.collection("appointments").add({
    ...baseAppointment,
    type: "exame",
    title: examTitle,
    date: EXAM_DATE_ISO,
  });

  const surgeryRef = await db.collection("appointments").add({
    ...baseAppointment,
    type: "cirurgia",
    title: surgeryTitle,
    date: SURGERY_DATE_ISO,
  });

  console.log(`[seed:test-appointments] exame criado: "${examTitle}" em ${EXAM_DATE_ISO} (id=${examRef.id})`);
  console.log(`[seed:test-appointments] cirurgia criada: "${surgeryTitle}" em ${SURGERY_DATE_ISO} (id=${surgeryRef.id})`);
  console.log("[seed:test-appointments] concluído.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed:test-appointments] falha:", err instanceof Error ? err.message : err);
  process.exit(1);
});
