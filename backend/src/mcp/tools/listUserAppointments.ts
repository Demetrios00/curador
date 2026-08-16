import { z } from "zod";

import { listAppointmentsByPatient } from "../../repositories/appointments.repository";

/**
 * Definição da ferramenta MCP `list_user_appointments`.
 *
 * Mantida separada do arquivo do servidor para poder ser testada
 * isoladamente e para deixar claro que "ferramenta" e "servidor que a
 * hospeda" são conceitos diferentes — um mesmo servidor pode, no futuro,
 * hospedar mais de uma ferramenta (ex.: get_exam_instructions na Fase 6)
 * sem que este arquivo mude.
 */
export const LIST_USER_APPOINTMENTS_TOOL_NAME = "list_user_appointments";

export const listUserAppointmentsInputSchema = {
  patientUid: z.string().min(1).describe("UID do paciente autenticado no Firebase, dono dos agendamentos."),
};

export async function listUserAppointmentsHandler({ patientUid }: { patientUid: string }) {
  const appointments = await listAppointmentsByPatient(patientUid);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(appointments) }],
  };
}
