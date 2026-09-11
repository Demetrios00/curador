import { z } from "zod";

import {
  createAppointmentRecord,
  hasConflictingAppointment,
} from "../../repositories/schedulingCatalog.repository";

/**
 * Ferramenta MCP `create_appointment` (Ideia 5b — criação de agendamento
 * via linguagem natural, `claude/avaliacao-evolucao-pre-fase8.md`).
 *
 * PRIMEIRA ferramenta MCP de ESCRITA do projeto — até aqui (Fases 5/6),
 * as 4 ferramentas existentes só liam o Firestore. Por isso, diferente
 * delas, esta ferramenta:
 *
 * 1. Nunca é chamada a partir de uma mensagem em linguagem natural
 *    diretamente — só depois que o paciente CONFIRMA explicitamente um
 *    resumo (`AppointmentDraft`) que o Agente de Agendamentos já resolveu
 *    e devolveu na resposta anterior (decisão aprovada em 02/09/2026:
 *    confirmação sempre obrigatória antes de qualquer escrita).
 * 2. Refaz a verificação de conflito de horário imediatamente antes de
 *    gravar (além da checagem "otimista" que o agente já fez ao montar o
 *    rascunho) — reduz a janela de corrida entre "mostrar o resumo" e
 *    "confirmar", mas não a elimina por completo (ver limitação anotada em
 *    `repositories/schedulingCatalog.repository.ts`).
 * 3. Retorna `conflict: true` como um resultado de NEGÓCIO normal (não
 *    como erro MCP/`isError`) quando a checagem final falha — permite ao
 *    agente responder com uma mensagem clara ("esse horário acabou de ser
 *    ocupado") em vez de propagar uma exceção genérica.
 */
export const CREATE_APPOINTMENT_TOOL_NAME = "create_appointment";

export const createAppointmentInputSchema = {
  patientUid: z.string().min(1).describe("UID do paciente autenticado, dono do novo agendamento."),
  type: z.enum(["consulta", "exame", "cirurgia", "online"]).describe("Tipo do agendamento."),
  title: z.string().min(1).describe("Título já resolvido (ex.: \"Consulta Cardiologia\", \"Hemograma\")."),
  hospitalId: z.string().min(1).describe("ID real da unidade (coleção hospitals), já resolvido pelo agente."),
  hospitalName: z.string().min(1).describe("Nome da unidade, para exibição."),
  specialtyId: z.string().nullable().describe("ID da especialidade (coleção specialties), quando type for consulta/online."),
  doctorId: z.string().nullable().describe("ID do médico (coleção doctors), quando um médico específico foi escolhido."),
  doctorName: z.string().nullable().describe("Nome do médico, para exibição."),
  date: z.string().min(1).describe("Data/hora ISO 8601 do agendamento."),
  notes: z.string().nullable().describe("Observações opcionais."),
};

interface CreateAppointmentArgs {
  patientUid: string;
  type: "consulta" | "exame" | "cirurgia" | "online";
  title: string;
  hospitalId: string;
  hospitalName: string;
  specialtyId: string | null;
  doctorId: string | null;
  doctorName: string | null;
  date: string;
  notes: string | null;
}

export async function createAppointmentHandler(args: CreateAppointmentArgs) {
  const conflict = await hasConflictingAppointment({
    hospitalId: args.hospitalId,
    doctorId: args.doctorId,
    dateIso: args.date,
  });

  if (conflict) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ conflict: true }) }],
    };
  }

  const appointment = await createAppointmentRecord({
    patientUid: args.patientUid,
    type: args.type,
    title: args.title,
    hospitalId: args.hospitalId,
    hospitalName: args.hospitalName,
    specialtyId: args.specialtyId,
    doctorId: args.doctorId,
    doctorName: args.doctorName,
    date: args.date,
    notes: args.notes,
  });

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ conflict: false, appointment }) }],
  };
}
