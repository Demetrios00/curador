import "dotenv/config";

import { getAdminFirestore } from "../src/firebase/admin";

/**
 * Popula a coleção `instructions` com um registro genérico para cada
 * `examTypes`/`surgeryTypes` já cadastrado no Firestore — sem inventar
 * nomes de exames/cirurgias específicos, já que este script não tem
 * conhecimento do que realmente existe no banco de cada ambiente.
 *
 * Idempotente: pula tipos que já têm instrução cadastrada (não duplica a
 * cada execução). Pode ser rodado quantas vezes forem necessárias.
 *
 * O texto de cada instrução é um placeholder operacional — ajuste pelo
 * Firebase Console (coleção `instructions`) para orientações reais e
 * específicas de cada exame/cirurgia quando desejar.
 *
 * Uso: `npm run seed:instructions` (requer as mesmas variáveis
 * FIREBASE_* já usadas por `firebase-check`).
 */
async function main() {
  const db = getAdminFirestore();

  const [examTypesSnap, surgeryTypesSnap, existingSnap] = await Promise.all([
    db.collection("examTypes").get(),
    db.collection("surgeryTypes").get(),
    db.collection("instructions").get(),
  ]);

  const existingKeys = new Set(
    existingSnap.docs.map((doc) => {
      const data = doc.data();
      return `${data.scope}:${data.examTypeId ?? data.surgeryTypeId}`;
    })
  );

  let created = 0;

  for (const doc of examTypesSnap.docs) {
    const key = `exam:${doc.id}`;
    if (existingKeys.has(key)) continue;

    await db.collection("instructions").add({
      scope: "exam",
      examTypeId: doc.id,
      surgeryTypeId: null,
      title: `Preparo para ${doc.data().name}`,
      instructionsText:
        "Chegue com 15 minutos de antecedência. Traga um documento de identidade com foto e o pedido médico. " +
        "Caso tenha alguma restrição alimentar ou de medicação, informe a recepção no momento do check-in.",
      updatedAt: Date.now(),
    });
    created++;
  }

  for (const doc of surgeryTypesSnap.docs) {
    const key = `surgery:${doc.id}`;
    if (existingKeys.has(key)) continue;

    await db.collection("instructions").add({
      scope: "surgery",
      examTypeId: null,
      surgeryTypeId: doc.id,
      title: `Preparo para ${doc.data().name}`,
      instructionsText:
        "Siga rigorosamente o jejum indicado pela equipe médica. Traga todos os exames pré-operatórios e " +
        "chegue ao hospital com pelo menos 1 hora de antecedência.",
      updatedAt: Date.now(),
    });
    created++;
  }

  console.log(
    `[seed:instructions] concluído. ${created} registro(s) criado(s) ` +
      `(examTypes encontrados: ${examTypesSnap.size}, surgeryTypes encontrados: ${surgeryTypesSnap.size}, ` +
      `já existentes ignorados: ${existingKeys.size}).`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed:instructions] falha ao popular a coleção:", err);
  process.exit(1);
});
