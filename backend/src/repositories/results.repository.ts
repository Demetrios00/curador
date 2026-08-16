import { getAdminFirestore } from "../firebase/admin";
import { withTimeout } from "../utils/withTimeout";

/**
 * Schema real da coleção `results` (confirmado em `types/index.ts` e
 * `Resultados.tsx` do app mobile — não inventado).
 *
 * Deliberadamente NÃO expomos o campo `summary` (existe no Firestore, mas
 * pode conter um laudo/interpretação clínica escrita pelo médico) neste
 * repositório — o Agente de Resultados nunca deve repassar interpretação
 * clínica, apenas disponibilidade (Seção 10.3 do projeto: "Não deve
 * interpretar resultados médicos nem produzir diagnósticos"). Se uma
 * necessidade futura exigir mostrar o `summary` ao paciente, isso deve ser
 * uma decisão explícita, não um efeito colateral deste repositório.
 */
export interface ResultRecord {
  id: string;
  patientUid: string;
  type: "exame" | "consulta" | string;
  title: string;
  hospitalName: string;
  date: string;
  status: "disponivel" | "processando" | string;
  hasFile: boolean;
}

export async function listResultsByPatient(patientUid: string): Promise<ResultRecord[]> {
  const snapshot = await withTimeout(
    getAdminFirestore()
      .collection("results")
      .where("patientUid", "==", patientUid)
      .orderBy("date", "desc")
      .get(),
    8000,
    "results.listByPatient"
  );

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      patientUid: data.patientUid,
      type: data.type,
      title: data.title,
      hospitalName: data.hospitalName ?? "",
      date: data.date,
      status: data.status,
      hasFile: Boolean(data.fileURL),
    } satisfies ResultRecord;
  });
}
