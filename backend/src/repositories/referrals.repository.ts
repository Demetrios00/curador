import { getAdminFirestore } from "../firebase/admin";
import { withTimeout } from "../utils/withTimeout";

/**
 * Schema real da coleção `referrals` (confirmado em `mobile/src/types/index.ts`
 * e `Encaminhamentos.tsx` do app mobile — não inventado). Até a Ideia 4b
 * (claude/ideia4b-score-saude-dia-proposta.md), esta coleção só era lida
 * diretamente pelo mobile; este é o primeiro repositório de `referrals` no
 * backend, usado pelo `healthScore.service.ts` para compor o domínio
 * "Encaminhamentos" do score "Saúde em Dia".
 */
export interface ReferralRecord {
  id: string;
  patientUid: string;
  type: "consulta" | "cirurgia" | string;
  specialty: string;
  doctorName: string;
  date: string;
  status: "pendente" | "agendado" | "concluido" | string;
}

export async function listReferralsByPatient(patientUid: string): Promise<ReferralRecord[]> {
  const snapshot = await withTimeout(
    getAdminFirestore()
      .collection("referrals")
      .where("patientUid", "==", patientUid)
      .orderBy("date", "desc")
      .get(),
    8000,
    "referrals.listByPatient"
  );

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      patientUid: data.patientUid,
      type: data.type,
      specialty: data.specialty ?? "",
      doctorName: data.doctorName ?? "",
      date: data.date,
      status: data.status,
    } satisfies ReferralRecord;
  });
}
