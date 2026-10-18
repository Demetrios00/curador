import { getAdminFirestore } from "../firebase/admin";
import { withTimeout } from "../utils/withTimeout";

/**
 * Schema real da coleção `appointments` (confirmado em `NovoAgendamento.tsx`
 * e `Agendamentos.tsx` do app mobile — não inventado). `date` é uma string
 * ISO 8601, gravada pelo app via `selectedDate.toISOString()`.
 */
export interface AppointmentRecord {
  id: string;
  patientUid: string;
  type: "consulta" | "exame" | "cirurgia" | "online" | string;
  title: string;
  doctorName: string | null;
  hospitalName: string;
  date: string;
  status: "agendado" | "confirmado" | "concluido" | "cancelado" | "perdido" | string;
  notes: string | null;
}

export async function listAppointmentsByPatient(patientUid: string): Promise<AppointmentRecord[]> {
  const snapshot = await withTimeout(
    getAdminFirestore()
      .collection("appointments")
      .where("patientUid", "==", patientUid)
      .orderBy("date", "desc")
      .get(),
    8000,
    "appointments.listByPatient"
  );

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      patientUid: data.patientUid,
      type: data.type,
      title: data.title,
      doctorName: data.doctorName ?? null,
      hospitalName: data.hospitalName ?? "",
      date: data.date,
      status: data.status,
      notes: data.notes ?? null,
    } satisfies AppointmentRecord;
  });
}
