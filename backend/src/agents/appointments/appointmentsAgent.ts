import { callListUserAppointments } from "../../mcp/clients/appointmentsMcpClient";
import type { AppointmentRecord } from "../../repositories/appointments.repository";

/**
 * Status "amigável" para exibição ao paciente, derivado de `AppointmentRecord.status`
 * (persistido no Firestore) e da data do agendamento.
 *
 * "Perdido" NÃO é um valor persistido em `appointments.status` — o schema real
 * (auditoria Fase 0) só tem `agendado | confirmado | concluido | cancelado`.
 * Ele é CALCULADO aqui: um agendamento com status "agendado"/"confirmado" cuja
 * data já passou é tratado como perdido. Decisão registrada em
 * `claude/avaliacao-evolucao-pre-fase8.md` (opção "status calculado", em vez de
 * gravar um quinto valor no Firestore) — evita migração de dado e não depende de
 * nenhum job em segundo plano para "marcar" o agendamento como perdido; o cálculo
 * é sempre refeito a partir do dado real, então uma atualização posterior do
 * registro (ex.: para "concluido") já reflete corretamente na próxima consulta.
 */
export type AppointmentDisplayStatus = "Marcado" | "Realizado" | "Cancelado" | "Perdido";

export interface AppointmentWithDisplayStatus extends AppointmentRecord {
  displayStatus: AppointmentDisplayStatus;
}

export interface AppointmentsAgentSummary {
  /** Total de agendamentos do paciente — passados e futuros. */
  total: number;
  marcados: number;
  realizados: number;
  cancelados: number;
  perdidos: number;
}

export interface AppointmentsAgentResult {
  message: string;
  /** Agendamentos futuros (status "Marcado"), ordenados do mais próximo para o mais distante. Mesmo nome/formato das Fases 4/5 — nenhum consumidor existente quebra. */
  upcoming: AppointmentWithDisplayStatus[];
  /** NOVO (Fase 5a): agendamentos já passados (Realizado, Cancelado ou Perdido), ordenados do mais recente para o mais antigo. */
  history: AppointmentWithDisplayStatus[];
  /** NOVO (Fase 5a): contagens por status, sobre TODOS os agendamentos do paciente (passados + futuros). */
  summary: AppointmentsAgentSummary;
}

/**
 * Agente de Agendamentos (Fase 4, integrado ao MCP na Fase 5, consulta
 * ampliada a passado + status na Fase 5a).
 *
 * Responsabilidade única: consultar e resumir os agendamentos do paciente.
 * Ainda não cria, altera nem cancela agendamentos (Seção 10.1 do projeto —
 * avaliado separadamente como possível "Fase 5b", de maior complexidade).
 * Não interpreta a mensagem do usuário — quem já fez isso foi o orquestrador
 * (classificação de intenção); o agente só sabe que o domínio é
 * "agendamentos" e qual paciente perguntou.
 *
 * Desde a Fase 5, este agente NÃO importa mais o repositório do Firestore
 * diretamente — ele pede o dado à ferramenta MCP `list_user_appointments`,
 * hospedada por um servidor MCP separado (`mcp/servers/appointmentsMcpServer.ts`).
 *
 * ANTES (Fases 4/5): a ferramenta MCP já retornava TODOS os agendamentos do
 * paciente (o repositório nunca teve filtro de data — ver
 * `repositories/appointments.repository.ts`), mas este agente descartava
 * tudo que não fosse futuro antes de montar a resposta, e nunca expunha o
 * status de forma explícita na mensagem.
 * DEPOIS (Fase 5a): nenhum agendamento é descartado — cada um recebe um
 * `displayStatus` explícito (Marcado/Realizado/Cancelado/Perdido), e a
 * resposta passa a incluir contagens (`summary`) e o histórico
 * (`history`), além da lista de futuros (`upcoming`, mantida).
 * MOTIVO: a Seção 10.1 do projeto já previa "verificar status" como
 * responsabilidade deste agente; retornar só o futuro escondia
 * cancelamentos e agendamentos perdidos do paciente.
 * IMPACTO NO TCC: nenhuma mudança de arquitetura — mesmo agente, mesma
 * ferramenta MCP, mesmo repositório, mesma coleção Firestore. Só enriquece
 * o exemplo de resposta já citado no artigo/README.
 */
export async function handleAppointmentsRequest(patientUid: string): Promise<AppointmentsAgentResult> {
  const appointments = await callListUserAppointments(patientUid);
  const now = Date.now();

  const withStatus: AppointmentWithDisplayStatus[] = appointments
    .map((a) => ({ ...a, displayStatus: computeDisplayStatus(a, now) }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const upcoming = withStatus
    .filter((a) => a.displayStatus === "Marcado")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // `withStatus` já está ordenado do mais recente para o mais antigo — como
  // datas futuras são numericamente maiores que passadas, os "Marcado"
  // aparecem primeiro nele; removê-los aqui preserva a ordem (mais recente
  // → mais antigo) para o restante (Realizado/Cancelado/Perdido).
  const history = withStatus.filter((a) => a.displayStatus !== "Marcado");

  const summary: AppointmentsAgentSummary = {
    total: withStatus.length,
    marcados: upcoming.length,
    realizados: withStatus.filter((a) => a.displayStatus === "Realizado").length,
    cancelados: withStatus.filter((a) => a.displayStatus === "Cancelado").length,
    perdidos: withStatus.filter((a) => a.displayStatus === "Perdido").length,
  };

  return {
    message: buildSummaryMessage(upcoming, summary),
    upcoming,
    history,
    summary,
  };
}

export function computeDisplayStatus(a: AppointmentRecord, now: number): AppointmentDisplayStatus {
  if (a.status === "cancelado") return "Cancelado";
  if (a.status === "concluido") return "Realizado";
  // "agendado" | "confirmado" | qualquer valor não previsto no schema atual
  return new Date(a.date).getTime() < now ? "Perdido" : "Marcado";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

function formatBreakdown(summary: AppointmentsAgentSummary): string | null {
  const parts: string[] = [];
  if (summary.marcados > 0) parts.push(`${summary.marcados} marcado(s)`);
  if (summary.realizados > 0) parts.push(`${summary.realizados} realizado(s)`);
  if (summary.cancelados > 0) parts.push(`${summary.cancelados} cancelado(s)`);
  if (summary.perdidos > 0) parts.push(`${summary.perdidos} perdido(s)`);

  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

export function buildSummaryMessage(
  upcoming: AppointmentWithDisplayStatus[],
  summary: AppointmentsAgentSummary
): string {
  if (summary.total === 0) {
    return "Você ainda não tem nenhum agendamento registrado.";
  }

  const totalLabel = summary.total === 1 ? "1 agendamento" : `${summary.total} agendamentos`;
  const breakdown = formatBreakdown(summary);

  if (upcoming.length > 0) {
    const next = upcoming[0];
    const nextDescription = `${next.title} em ${formatDate(next.date)}${next.hospitalName ? ` (${next.hospitalName})` : ""}`;
    return breakdown
      ? `Você tem ${totalLabel} no total (${breakdown}). O próximo é ${nextDescription}.`
      : `O próximo é ${nextDescription}.`;
  }

  // Sem nenhum agendamento futuro — resume só o histórico.
  return breakdown
    ? `Você não tem nenhum agendamento futuro no momento. No histórico, você tem ${totalLabel} (${breakdown}).`
    : "Você não tem nenhum agendamento futuro no momento.";
}
