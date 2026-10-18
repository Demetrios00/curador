import { computeDisplayStatus } from "../agents/appointments/appointmentsAgent";
import { listAppointmentsByPatient, type AppointmentRecord } from "../repositories/appointments.repository";
import { listReferralsByPatient, type ReferralRecord } from "../repositories/referrals.repository";
import { listResultsByPatient, type ResultRecord } from "../repositories/results.repository";

/**
 * Ideia 4b (claude/ideia4b-score-saude-dia-proposta.md, aprovada em
 * 16/08/2026) — score "Saúde em Dia".
 *
 * ANTES: `Home.tsx` calculava `realizados / 5 * 100` — meta fixa arbitrária,
 * sem checar histórico, sem considerar pendências, dentro do componente
 * React (violava a Seção 21 do projeto).
 * DEPOIS: cálculo movido para o backend, exposto via
 * `GET /api/patients/me/health-score` (`controllers/patients.controller.ts`).
 * O mobile só exibe o resultado.
 *
 * IMPORTANTE (Seção 24 do projeto): este é um score HEURÍSTICO — uma
 * decisão de design definida por regras aprovadas com o orientando, NÃO um
 * resultado de pesquisa validado estatisticamente com usuários reais. Se
 * citado no TCC, deve vir acompanhado dessa ressalva.
 */

export interface DomainScore {
  finalizados: number;
  pendentes: number;
  /** 0–100, arredondado. `finalizados / (finalizados + pendentes) * 100`. */
  score: number;
}

export type ImprovementType = "attendance_pending" | "referral_pending" | "appointment_missed" | "result_processing";

export interface Improvement {
  type: ImprovementType;
  message: string;
  refId: string;
}

export interface HealthScoreResult {
  /** false quando o paciente não tem nenhum agendamento registrado (gate aprovado — ver proposta). */
  eligible: boolean;
  /** Média simples dos domainScore elegíveis (com ≥1 item). null quando `eligible = false` ou nenhum domínio tem dado. */
  score: number | null;
  domains: {
    appointments: DomainScore | null;
    results: DomainScore | null;
    referrals: DomainScore | null;
  };
  /** Até 3 alertas, só os acionáveis pelo paciente (ver regras de priorização abaixo). */
  improvements: Improvement[];
}

const MAX_IMPROVEMENTS = 3;
/** Resultado "processando" só entra como alerta informativo se a data do exame já passou desse limiar. */
const RESULT_PROCESSING_ALERT_DAYS = 5;

export async function computeHealthScore(patientUid: string): Promise<HealthScoreResult> {
  const [appointments, results, referrals] = await Promise.all([
    listAppointmentsByPatient(patientUid),
    listResultsByPatient(patientUid),
    listReferralsByPatient(patientUid),
  ]);

  // Gate aprovado: sem nenhum agendamento (qualquer status, passado ou
  // futuro), não há score — não é "score baixo", é "ainda não aplicável".
  if (appointments.length === 0) {
    return {
      eligible: false,
      score: null,
      domains: { appointments: null, results: null, referrals: null },
      improvements: [],
    };
  }

  const now = Date.now();

  const domains = {
    appointments: computeAppointmentsDomain(appointments, now),
    results: computeResultsDomain(results),
    referrals: computeReferralsDomain(referrals),
  };

  const eligibleDomainScores = Object.values(domains).filter((d): d is DomainScore => d !== null);
  const score =
    eligibleDomainScores.length > 0
      ? Math.round(eligibleDomainScores.reduce((sum, d) => sum + d.score, 0) / eligibleDomainScores.length)
      : null;

  return {
    eligible: true,
    score,
    domains,
    improvements: buildImprovements(appointments, referrals, results, now),
  };
}

function toDomainScore(finalizados: number, pendentes: number): DomainScore | null {
  const total = finalizados + pendentes;
  if (total === 0) return null;
  return { finalizados, pendentes, score: Math.round((finalizados / total) * 100) };
}

/**
 * Domínio "Agendamentos": finalizado = concluído; pendente = agendado ou
 * confirmado — inclui tanto "Marcado" (futuro) quanto "Perdido" (data
 * passada, nunca concluído/cancelado; calculado pela Fase 5a via
 * `computeDisplayStatus`, não persistido). Cancelado não conta em nenhum
 * dos dois lados (aprovado na proposta).
 */
function computeAppointmentsDomain(appointments: AppointmentRecord[], now: number): DomainScore | null {
  let finalizados = 0;
  let pendentes = 0;
  for (const a of appointments) {
    if (a.status === "cancelado") continue;
    const displayStatus = computeDisplayStatus(a, now);
    if (displayStatus === "Realizado") finalizados++;
    else if (displayStatus === "Marcado" || displayStatus === "Perdido" || displayStatus === "Aguardando confirmação") pendentes++;
  }
  return toDomainScore(finalizados, pendentes);
}

/** Domínio "Resultados": finalizado = disponível; pendente = processando. */
function computeResultsDomain(results: ResultRecord[]): DomainScore | null {
  const finalizados = results.filter((r) => r.status === "disponivel").length;
  const pendentes = results.filter((r) => r.status === "processando").length;
  return toDomainScore(finalizados, pendentes);
}

/**
 * Domínio "Encaminhamentos": finalizado = concluído OU já agendado (o
 * paciente já agiu — inclusive via Ideia 3, encaminhamento → novo
 * agendamento); pendente = ainda não agendado (aprovado na proposta, ponto 2).
 */
function computeReferralsDomain(referrals: ReferralRecord[]): DomainScore | null {
  const finalizados = referrals.filter((r) => r.status === "concluido" || r.status === "agendado").length;
  const pendentes = referrals.filter((r) => r.status === "pendente").length;
  return toDomainScore(finalizados, pendentes);
}

/**
 * Até 3 alertas, nesta ordem de prioridade (aprovado na proposta, ponto 5):
 * 1. Encaminhamentos pendentes (mais antigos primeiro) — o paciente precisa agendar.
 * 2. Agendamentos perdidos (mais antigos primeiro) — o paciente precisa remarcar/contatar a unidade.
 * 3. Só se nada dos itens acima existir: resultado em processamento há mais
 *    de `RESULT_PROCESSING_ALERT_DAYS` dias — informativo, NÃO é uma ação
 *    pendente do paciente (o atraso não depende dele), por isso só aparece
 *    na ausência de algo realmente acionável.
 */
function buildImprovements(
  appointments: AppointmentRecord[],
  referrals: ReferralRecord[],
  results: ResultRecord[],
  now: number
): Improvement[] {
  const improvements: Improvement[] = [];

  // 18/10/2026: prioridade máxima — confirmar presença em agendamentos
  // passados ainda abertos (ação rápida do paciente, que também corrige o
  // histórico e o próprio score).
  const awaitingAttendance = appointments
    .filter((a) => computeDisplayStatus(a, now) === "Aguardando confirmação")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  for (const a of awaitingAttendance) {
    if (improvements.length >= MAX_IMPROVEMENTS) return improvements;
    improvements.push({
      type: "attendance_pending",
      message: `Você compareceu a ${a.title} de ${formatDateBR(a.date)}? Confirme no histórico.`,
      refId: a.id,
    });
  }

  const pendingReferrals = referrals
    .filter((r) => r.status === "pendente")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (const r of pendingReferrals) {
    if (improvements.length >= MAX_IMPROVEMENTS) return improvements;
    improvements.push({
      type: "referral_pending",
      message: `Você tem um encaminhamento de ${r.specialty} de ${formatDateBR(r.date)} ainda não agendado.`,
      refId: r.id,
    });
  }

  const missedAppointments = appointments
    .filter((a) => a.status !== "cancelado" && computeDisplayStatus(a, now) === "Perdido")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (const a of missedAppointments) {
    if (improvements.length >= MAX_IMPROVEMENTS) return improvements;
    improvements.push({
      type: "appointment_missed",
      message: `Você perdeu ${a.title} de ${formatDateBR(a.date)}.`,
      refId: a.id,
    });
  }

  if (improvements.length === 0) {
    const staleResults = results
      .filter(
        (r) => r.status === "processando" && daysBetween(new Date(r.date).getTime(), now) > RESULT_PROCESSING_ALERT_DAYS
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const r of staleResults) {
      if (improvements.length >= MAX_IMPROVEMENTS) return improvements;
      improvements.push({
        type: "result_processing",
        message: `Seu exame de ${r.title} ainda está em processamento desde ${formatDateBR(r.date)}.`,
        refId: r.id,
      });
    }
  }

  return improvements;
}

function daysBetween(pastMs: number, nowMs: number): number {
  return (nowMs - pastMs) / (1000 * 60 * 60 * 24);
}

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
