import "dotenv/config";

import { getAdminAuth, getAdminFirestore } from "../src/firebase/admin";

/**
 * Massa de dados de demonstração para um paciente de teste (18/10/2026).
 *
 * - Marca como "concluido" (presença confirmada) os agendamentos já
 *   passados cujo título contenha algum dos termos de --concluir
 *   (padrão: "Gastroenterologia" e "Colonoscopia").
 * - Cria/atualiza resultados, prescrições e encaminhamentos com IDs
 *   determinísticos (`demo-<uid>-...`): rodar de novo NÃO duplica dados.
 *
 * Uso:
 *   npm run seed:demo-user -- --email=teste2@tcc2.com
 *   npm run seed:demo-user -- --email=outro@x.com --concluir=Cardiologia,Hemograma
 *
 * Nenhum dado aqui contém interpretação clínica (sem campo `summary`):
 * os agentes do CuraDor só informam disponibilidade/status (Seções 10.3/23).
 */
function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

const daysFromNow = (d: number, hour = 9) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(hour, 0, 0, 0);
  return t.toISOString();
};

async function main() {
  const email = arg("email") ?? process.env.SEED_PATIENT_EMAIL;
  if (!email) throw new Error("Informe o paciente: npm run seed:demo-user -- --email=paciente@exemplo.com");
  const terms = (arg("concluir") ?? "Gastroenterologia,Colonoscopia").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);

  const db = getAdminFirestore();
  const user = await getAdminAuth().getUserByEmail(email);
  const uid = user.uid;
  console.log(`[seed:demo-user] paciente: ${email} (uid=${uid})`);

  // 1) Presença confirmada nos agendamentos passados indicados
  const apptSnap = await db.collection("appointments").where("patientUid", "==", uid).get();
  const now = Date.now();
  let concluded = 0;
  let defaultHospital = "Hospital Vida Caps";
  for (const doc of apptSnap.docs) {
    const a = doc.data();
    const title = String(a.title ?? "").toLowerCase();
    if (a.hospitalName) defaultHospital = a.hospitalName;
    const isPast = new Date(a.date).getTime() < now;
    if (isPast && terms.some((t) => title.includes(t)) && a.status !== "cancelado") {
      await doc.ref.update({ status: "concluido", attendanceConfirmedAt: now });
      console.log(`[seed:demo-user] agendamento concluído: ${a.title} (${a.date})`);
      concluded++;
    }
  }
  if (concluded === 0) console.log("[seed:demo-user] nenhum agendamento passado correspondeu aos termos:", terms.join(", "));

  const id = (suffix: string) => `demo-${uid}-${suffix}`;

  // 2) Resultados (sem `summary`/interpretação clínica)
  const results = [
    { key: "res-colonoscopia", type: "exame", title: "Colonoscopia", doctorName: "Dr. Rafael Nunes", hospitalName: defaultHospital, date: daysFromNow(0, 12), status: "disponivel" },
    { key: "res-gastro", type: "consulta", title: "Relatório de consulta — Gastroenterologia", doctorName: "Dra. Camila Rocha", hospitalName: defaultHospital, date: daysFromNow(0, 12), status: "disponivel" },
    { key: "res-hemograma", type: "exame", title: "Hemograma completo", doctorName: "Dra. Camila Rocha", hospitalName: defaultHospital, date: daysFromNow(-2), status: "processando" },
    { key: "res-glicemia", type: "exame", title: "Glicemia em jejum", doctorName: "Dr. Rafael Nunes", hospitalName: defaultHospital, date: daysFromNow(-20), status: "disponivel" },
  ];
  for (const { key, ...r } of results) {
    await db.collection("results").doc(id(key)).set({ patientUid: uid, ...r, seedTag: "demo-18-10" });
  }
  console.log(`[seed:demo-user] ${results.length} resultados criados/atualizados`);

  // 3) Prescrições
  const prescriptions = [
    {
      key: "presc-gastro",
      doctorName: "Dra. Camila Rocha",
      specialty: "Gastroenterologia",
      date: daysFromNow(0, 13),
      controlled: false,
      medications: [
        { name: "Omeprazol 20 mg", dosage: "1 cápsula", frequency: "1x ao dia, em jejum", duration: "30 dias" },
        { name: "Simeticona 40 mg", dosage: "1 comprimido", frequency: "Após as refeições, se necessário", duration: "15 dias" },
      ],
      notes: "Prescrição de demonstração para testes do protótipo.",
    },
    {
      key: "presc-clinico",
      doctorName: "Dr. Rafael Nunes",
      specialty: "Clínica Geral",
      date: daysFromNow(-12),
      controlled: false,
      medications: [{ name: "Vitamina D 2.000 UI", dosage: "1 cápsula", frequency: "1x ao dia", duration: "60 dias" }],
    },
  ];
  for (const { key, ...p } of prescriptions) {
    await db.collection("prescriptions").doc(id(key)).set({ patientUid: uid, ...p, seedTag: "demo-18-10" });
  }
  console.log(`[seed:demo-user] ${prescriptions.length} prescrições criadas/atualizadas`);

  // 4) Encaminhamentos
  const referrals = [
    { key: "ref-cardio", type: "consulta", specialty: "Cardiologia", reason: "Avaliação de rotina solicitada pela clínica geral", doctorName: "Dr. Rafael Nunes", date: daysFromNow(-5), status: "pendente" },
    { key: "ref-nutri", type: "consulta", specialty: "Nutrição", reason: "Acompanhamento após consulta de gastroenterologia", doctorName: "Dra. Camila Rocha", date: daysFromNow(0, 13), status: "pendente" },
    { key: "ref-orto", type: "consulta", specialty: "Ortopedia", reason: "Dor lombar recorrente", doctorName: "Dr. Rafael Nunes", date: daysFromNow(-15), status: "agendado" },
  ];
  for (const { key, ...r } of referrals) {
    await db.collection("referrals").doc(id(key)).set({ patientUid: uid, ...r, seedTag: "demo-18-10" });
  }
  console.log(`[seed:demo-user] ${referrals.length} encaminhamentos criados/atualizados`);
  console.log("[seed:demo-user] concluído.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed:demo-user] falha:", err instanceof Error ? err.message : err);
  process.exit(1);
});
