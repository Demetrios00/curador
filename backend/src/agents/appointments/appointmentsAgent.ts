import { callListUserAppointments } from "../../mcp/clients/appointmentsMcpClient";
import type { AppointmentRecord } from "../../repositories/appointments.repository";

export interface AppointmentsAgentResult {
  message: string;
  upcoming: AppointmentRecord[];
}

/**
 * Agente de Agendamentos (Fase 4, integrado ao MCP na Fase 5).
 *
 * Responsabilidade única: consultar e resumir os agendamentos do paciente.
 * Não cria, altera nem cancela agendamentos ainda (Seção 10.1 do projeto —
 * isso fica para uma evolução futura). Não interpreta a mensagem do
 * usuário — quem já fez isso foi o orquestrador (classificação de
 * intenção); o agente só sabe que o domínio é "agendamentos" e qual
 * paciente perguntou.
 *
 * Desde a Fase 5, este agente NÃO importa mais o repositório do Firestore
 * diretamente — ele pede o dado à ferramenta MCP `list_user_appointments`,
 * hospedada por um servidor MCP separado (`mcp/servers/appointmentsMcpServer.ts`).
 */
export async function handleAppointmentsRequest(patientUid: string): Promise<AppointmentsAgentResult> {
  const appointments = await callListUserAppointments(patientUid);

  const now = Date.now();
  const upcoming = appointments
    .filter((a) => new Date(a.date).getTime() >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    message: buildSummaryMessage(upcoming),
    upcoming,
  };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

function buildSummaryMessage(upcoming: AppointmentRecord[]): string {
  if (upcoming.length === 0) {
    return "Você não tem nenhum agendamento futuro no momento.";
  }

  const next = upcoming[0];
  const nextDescription = `${next.title} em ${formatDate(next.date)}${next.hospitalName ? ` (${next.hospitalName})` : ""}`;

  if (upcoming.length === 1) {
    return `Você tem 1 agendamento futuro: ${nextDescription}.`;
  }

  return `Você tem ${upcoming.length} agendamentos futuros. O próximo é ${nextDescription}.`;
}
