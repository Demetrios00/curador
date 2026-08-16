import { getAdminFirestore } from "../firebase/admin";
import { withTimeout } from "../utils/withTimeout";

export type InstructionScope = "exam" | "surgery";

/**
 * Schema da coleção `instructions` (nova nesta fase — não existia no
 * Firestore antes; ver `claude/fase6-instrucoes-status.md` para o modelo
 * completo, relacionamentos e decisão de design apresentados antes da
 * implementação).
 */
export interface InstructionRecord {
  id: string;
  scope: InstructionScope;
  examTypeId: string | null;
  surgeryTypeId: string | null;
  title: string;
  instructionsText: string;
}

/**
 * Resolve a instrução cadastrada para um procedimento a partir do TÍTULO do
 * agendamento (ex.: "Hemograma completo"), não de um ID.
 *
 * Motivo: a coleção `appointments` grava apenas o `title` calculado no
 * momento da criação (ver `NovoAgendamento.tsx` — `computedTitle`), nunca
 * `examTypeId`/`surgeryTypeId`. Por isso a resolução acontece em duas
 * etapas:
 *   1. localizar, em `examTypes` (ou `surgeryTypes`), o documento cujo
 *      `name` seja exatamente igual ao `title` do agendamento;
 *   2. localizar, em `instructions`, o documento vinculado a esse tipo.
 *
 * Se o título do agendamento não corresponder a nenhum tipo cadastrado (ex.:
 * o tipo foi excluído depois de o agendamento existir) ou não houver
 * instrução cadastrada para aquele tipo, o retorno é `null` de forma
 * controlada — nunca um erro, pois "ainda não há instrução cadastrada" é um
 * estado de negócio válido, não uma falha.
 */
export async function findInstructionsByProcedureTitle(
  procedureTitle: string,
  scope: InstructionScope
): Promise<InstructionRecord | null> {
  const db = getAdminFirestore();
  const typeCollection = scope === "exam" ? "examTypes" : "surgeryTypes";
  const fkField = scope === "exam" ? "examTypeId" : "surgeryTypeId";

  const typeSnapshot = await withTimeout(
    db.collection(typeCollection).where("name", "==", procedureTitle).limit(1).get(),
    8000,
    `instructions.resolveType.${typeCollection}`
  );

  if (typeSnapshot.empty) {
    return null;
  }

  const typeId = typeSnapshot.docs[0].id;

  const instructionSnapshot = await withTimeout(
    db.collection("instructions").where(fkField, "==", typeId).limit(1).get(),
    8000,
    "instructions.findByProcedureTitle"
  );

  if (instructionSnapshot.empty) {
    return null;
  }

  const doc = instructionSnapshot.docs[0];
  const data = doc.data();

  return {
    id: doc.id,
    scope,
    examTypeId: data.examTypeId ?? null,
    surgeryTypeId: data.surgeryTypeId ?? null,
    title: data.title,
    instructionsText: data.instructionsText,
  } satisfies InstructionRecord;
}
