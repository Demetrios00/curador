import { z } from "zod";

import { llmProvider } from "../../llm";
import {
  callCreateAppointment,
  callGetSchedulingCatalog,
} from "../../mcp/clients/appointmentsMcpClient";
import type { AppointmentRecord } from "../../repositories/appointments.repository";
import type { SchedulingCatalog } from "../../repositories/schedulingCatalog.repository";

/**
 * Ideia 5b — Agente de Agendamentos: criação via linguagem natural
 * (avaliada em `claude/avaliacao-evolucao-pre-fase8.md`, decisões de
 * escopo aprovadas em 02/09/2026).
 *
 * Três decisões de projeto aprovadas ANTES desta implementação, que
 * moldam todo o desenho abaixo:
 *
 * 1. CONFIRMAÇÃO SEMPRE EXPLÍCITA — este arquivo nunca grava um
 *    agendamento a partir de uma mensagem em linguagem natural sozinha.
 *    `buildAppointmentDraft` só produz um RASCUNHO (`AppointmentDraft`);
 *    somente `confirmAppointmentDraft`, chamado a partir de uma ação
 *    explícita do usuário no app (botão "Confirmar agendamento"), grava de
 *    fato — e só ele aciona a ferramenta MCP de escrita.
 * 2. MENSAGEM ÚNICA ESTRUTURADA, SEM ESTADO NO SERVIDOR — nenhum rascunho
 *    fica guardado no backend entre uma chamada e outra. O rascunho
 *    inteiro (`AppointmentDraft`) volta para o app na resposta, e é o
 *    PRÓPRIO APP quem devolve esse mesmo objeto, sem alteração, na
 *    confirmação (`POST /api/orchestrator/route` com `{ confirmDraft }`
 *    em vez de `{ message }`). Se faltar informação para montar o
 *    rascunho, a resposta pede que o paciente reenvie uma mensagem mais
 *    completa — não existe "continuar de onde parou" no servidor.
 * 3. CONFLITO DE HORÁRIO É VERIFICADO — uma única vez, de forma
 *    autoritativa, dentro da ferramenta MCP `create_appointment`,
 *    imediatamente antes de gravar (não ao montar o rascunho — checar
 *    duas vezes exigiria uma ferramenta MCP extra só para isso e ainda
 *    correria o risco de ficar desatualizado até a confirmação chegar).
 */

const ACTIVE_APPOINTMENT_TYPES = ["consulta", "exame", "cirurgia", "online"] as const;
type ActiveAppointmentType = (typeof ACTIVE_APPOINTMENT_TYPES)[number];

/**
 * Rascunho de agendamento já totalmente resolvido contra o cadastro real
 * (nenhum campo aqui é mais um texto livre da LLM — são IDs reais das
 * coleções `hospitals`/`specialties`/`doctors`/`examTypes`/`surgeryTypes`).
 * Os campos `*Name` são mantidos só para exibição (o app não precisa
 * buscar o catálogo de novo para montar o resumo), mas NUNCA são usados
 * para decidir nada em `confirmAppointmentDraft` — quem decide são os IDs.
 */
export interface AppointmentDraft {
  type: ActiveAppointmentType;
  title: string;
  hospitalId: string;
  hospitalName: string;
  specialtyId: string | null;
  doctorId: string | null;
  doctorName: string | null;
  dateIso: string;
  notes: string | null;
}

const appointmentDraftSchema = z.object({
  type: z.enum(ACTIVE_APPOINTMENT_TYPES),
  title: z.string().min(1),
  hospitalId: z.string().min(1),
  hospitalName: z.string().min(1),
  specialtyId: z.string().nullable(),
  doctorId: z.string().nullable(),
  doctorName: z.string().nullable(),
  dateIso: z.string().min(1),
  notes: z.string().nullable(),
});

/** Contexto de um pedido de agendamento ainda incompleto, devolvido pelo app na mensagem seguinte. */
export interface SchedulingPendingContext {
  kind: "schedule";
  text: string;
}

const MAX_PENDING_TEXT = 1000;

/** Valida o `pendingContext` recebido do cliente (nunca confiar cegamente no corpo da requisição). */
export function parsePendingContext(raw: unknown): SchedulingPendingContext | null {
  if (!raw || typeof raw !== "object") return null;
  const { kind, text } = raw as { kind?: unknown; text?: unknown };
  if (kind !== "schedule" || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_PENDING_TEXT) return null;
  return { kind: "schedule", text: trimmed };
}

/**
 * Com um pedido pendente, a nova mensagem é tratada como CONTINUAÇÃO (ex.:
 * "Ortopedia, dia 19 às 14h"), a menos que seja claramente uma pergunta
 * sobre outra coisa ("quais meus agendamentos?", "meu exame ficou pronto?")
 * — nesse caso o fluxo normal de classificação assume e o pendente é descartado.
 */
export function isSchedulingContinuation(message: string): boolean {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/\?\s*$/.test(normalized) && /\b(quais|qual|quando|onde|tenho|meus|minhas|resultado|pronto|unidade|perto|jejum|preparo)\b/.test(normalized)) {
    return false;
  }
  if (/\b(cancela(r)?|desisto|deixa pra la|esquece)\b/.test(normalized)) return false;
  return true;
}

export interface ScheduleAgentResult {
  message: string;
  needsInfo?: true;
  /**
   * Continuidade de conversa (18/10/2026): quando faltam dados, o texto
   * acumulado do pedido volta para o app, que o devolve junto com a
   * próxima mensagem. Mesmo princípio do rascunho (`draft`): nenhum estado
   * de conversa fica guardado no servidor.
   */
  pendingContext?: SchedulingPendingContext;
  requiresConfirmation?: true;
  draft?: AppointmentDraft;
  created?: boolean;
  conflict?: boolean;
  appointment?: AppointmentRecord;
}

/**
 * Classificador "consultar vs. criar".
 *
 * Correção 18/10/2026 (teste em dispositivo físico): a versão anterior usava
 * uma chamada extra ao LLM só para esta decisão binária. Somada à
 * classificação de intenção do orquestrador e à extração de campos, a
 * criação de agendamento exigia TRÊS chamadas sequenciais ao LLM e
 * ultrapassava o tempo limite do app com modelos gratuitos lentos.
 *
 * Decisão de projeto: a intenção do domínio (APPOINTMENTS) continua sendo
 * decidida pelo LLM no orquestrador; dentro do domínio, a sub-ação é uma
 * escolha binária com vocabulário pequeno e previsível ("agendar", "marcar",
 * "criar"...), resolvida por regra determinística — mais rápida, sem custo,
 * reprodutível e auditável. Na dúvida, cai em QUERY (somente leitura), o
 * caminho seguro: nunca abre um fluxo de escrita por engano, e a escrita em
 * si continua exigindo confirmação explícita do paciente.
 */
const CREATE_PATTERN =
  /\b(agend(ar|e|a|ou|amento novo)|marc(ar|a)|marqu(e|em)|remarc(ar|a)|remarqu(e|em)|cri(ar|e|a)|nov[oa] (agendamento|consulta|exame)|(quero|desejo|gostaria de|preciso) (fazer |marcar )?(um |uma )?(novo |nova )?(agendamento|consulta|exame|cirurgia))\b/i;

export async function classifyAppointmentAction(message: string): Promise<"QUERY" | "CREATE"> {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const looksLikeQuestionAboutExisting = /\b(quais|qual|quando|tenho|meus|minhas|proxim[oa]s?|historico|status)\b/i.test(normalized);
  const wantsToCreate = CREATE_PATTERN.test(normalized);
  // "Quais agendamentos eu tenho?" contém "agendamentos", mas não um verbo
  // de criação; "quero marcar..." vence mesmo contendo "quando".
  if (wantsToCreate && !(looksLikeQuestionAboutExisting && !/\b(agend(ar|e)|marc(ar|a)|marque|cri(ar|e)|remarc(ar|a)|fazer)\b/i.test(normalized))) {
    return "CREATE";
  }
  return "QUERY";
}

interface ExtractedFields {
  type: ActiveAppointmentType | null;
  specialtyName: string | null;
  examTypeName: string | null;
  surgeryTypeName: string | null;
  hospitalName: string | null;
  doctorName: string | null;
  dateTimeIso: string | null;
}

/**
 * Data/hora atual no fuso de referência do app (São Paulo), formatada por
 * extenso para dar à LLM uma âncora confiável ao resolver expressões
 * relativas ("amanhã", "semana que vem", "sexta-feira que vem").
 */
function currentDateTimeContext(): string {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  return `Agora é ${formatted} (horário de São Paulo/Brasília, UTC-3). Use esta referência para resolver datas relativas.`;
}

// Função (e não constante): a data de referência precisa ser a do momento
// da requisição, não a de quando o servidor foi iniciado.
const buildExtractionPrompt = (): string => `Você extrai dados estruturados de um pedido de agendamento de saúde em linguagem natural, em português do Brasil.

${currentDateTimeContext()}

Extraia:
- type: um destes valores exatos — "consulta", "exame", "cirurgia" ou "online" — ou null se não ficar claro.
- specialtyName: nome da especialidade médica mencionada (ex.: "Cardiologia"), só relevante para consulta/online, ou null.
- examTypeName: nome do exame mencionado (ex.: "Hemograma"), só relevante para type "exame", ou null.
- surgeryTypeName: nome do procedimento cirúrgico mencionado, só relevante para type "cirurgia", ou null.
- hospitalName: nome da unidade/hospital mencionado, ou null se não mencionado.
- doctorName: nome do médico mencionado, ou null se não mencionado (é normal não haver).
- dateTimeIso: data e hora resolvidas para um instante ABSOLUTO no formato ISO 8601 com o offset "-03:00" (ex.: "2026-09-10T14:00:00-03:00"), a partir de expressões relativas ou absolutas na mensagem — ou null se a mensagem não mencionar nem data nem hora.

Responda SOMENTE com um JSON válido, sem nenhum texto antes ou depois, exatamente neste formato:
{"type": ..., "specialtyName": ..., "examTypeName": ..., "surgeryTypeName": ..., "hospitalName": ..., "doctorName": ..., "dateTimeIso": ...}`;

async function extractAppointmentFields(message: string): Promise<ExtractedFields> {
  const raw = await llmProvider.complete([
    { role: "system", content: buildExtractionPrompt() },
    { role: "user", content: message },
  ]);

  const match = raw.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(match ? match[0] : raw) as Partial<ExtractedFields>;
    return {
      type: ACTIVE_APPOINTMENT_TYPES.includes(parsed.type as ActiveAppointmentType) ? (parsed.type as ActiveAppointmentType) : null,
      specialtyName: typeof parsed.specialtyName === "string" ? parsed.specialtyName : null,
      examTypeName: typeof parsed.examTypeName === "string" ? parsed.examTypeName : null,
      surgeryTypeName: typeof parsed.surgeryTypeName === "string" ? parsed.surgeryTypeName : null,
      hospitalName: typeof parsed.hospitalName === "string" ? parsed.hospitalName : null,
      doctorName: typeof parsed.doctorName === "string" ? parsed.doctorName : null,
      dateTimeIso: typeof parsed.dateTimeIso === "string" ? parsed.dateTimeIso : null,
    };
  } catch {
    return {
      type: null,
      specialtyName: null,
      examTypeName: null,
      surgeryTypeName: null,
      hospitalName: null,
      doctorName: null,
      dateTimeIso: null,
    };
  }
}

/** Casamento por nome, mesmo padrão (case-insensitive, substring) já usado nos prefills do mobile (Ideias 3 e 5). */
function findByName<T extends { name: string }>(items: T[], name: string | null): T | null {
  if (!name) return null;
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return (
    items.find((item) => item.name.trim().toLowerCase() === needle) ??
    items.find((item) => item.name.trim().toLowerCase().includes(needle)) ??
    null
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  return `${date} às ${time}`;
}

function computeTitle(type: ActiveAppointmentType, specialtyName: string | null, examName: string | null, surgeryName: string | null): string {
  if (type === "consulta") return `Consulta ${specialtyName ?? ""}`.trim();
  if (type === "online") return `Consulta online ${specialtyName ?? ""}`.trim();
  if (type === "exame") return examName ?? "Exame";
  return surgeryName ?? "Cirurgia";
}

/**
 * Monta um `AppointmentDraft` a partir de uma mensagem em linguagem
 * natural — ou explica, em texto claro, o que falta para conseguir montar
 * um (decisão aprovada: mensagem única, sem estado guardado no servidor;
 * o paciente reenvia uma mensagem mais completa em vez de preencher campo
 * a campo).
 */
export async function buildAppointmentDraft(_patientUid: string, message: string): Promise<ScheduleAgentResult> {
  const [extracted, catalog] = await Promise.all([extractAppointmentFields(message), callGetSchedulingCatalog()]);

  const missing: string[] = [];

  if (!extracted.type) {
    missing.push('o tipo (consulta, exame, cirurgia ou consulta online)');
  }

  const hospital = findByName(catalog.hospitals, extracted.hospitalName);
  if (!hospital) {
    missing.push("a unidade/hospital");
  }

  let specialty: SchedulingCatalog["specialties"][number] | null = null;
  let examType: SchedulingCatalog["examTypes"][number] | null = null;
  let surgeryType: SchedulingCatalog["surgeryTypes"][number] | null = null;

  if (extracted.type === "consulta" || extracted.type === "online") {
    specialty = findByName(catalog.specialties, extracted.specialtyName);
    if (!specialty) missing.push("a especialidade médica");
  } else if (extracted.type === "exame") {
    examType = findByName(catalog.examTypes, extracted.examTypeName);
    if (!examType) missing.push("o tipo de exame");
  } else if (extracted.type === "cirurgia") {
    surgeryType = findByName(catalog.surgeryTypes, extracted.surgeryTypeName);
    if (!surgeryType) missing.push("o tipo de cirurgia");
  }

  let dateIso: string | null = null;
  if (!extracted.dateTimeIso) {
    missing.push("a data e o horário");
  } else {
    const parsed = new Date(extracted.dateTimeIso);
    if (Number.isNaN(parsed.getTime())) {
      missing.push("uma data e horário válidos");
    } else if (parsed.getTime() < Date.now()) {
      missing.push("uma data e horário no futuro (a data informada já passou)");
    } else {
      dateIso = parsed.toISOString();
    }
  }

  if (missing.length > 0 || !extracted.type || !hospital || !dateIso) {
    return {
      message:
        `Para agendar, ainda preciso que você me informe ${formatMissingList(missing)}. ` +
        `Pode me enviar só o que falta.`,
      needsInfo: true,
      pendingContext: { kind: "schedule", text: message.slice(-MAX_PENDING_TEXT) },
    };
  }

  // Médico é opcional: se mencionado mas não encontrado (ou não atende
  // nessa unidade/especialidade), seguimos sem médico específico em vez de
  // bloquear — mesma opção "qualquer médico disponível" que
  // `NovoAgendamento.tsx` já oferece no formulário manual.
  const matchedDoctor = findByName(catalog.doctors, extracted.doctorName);
  const doctor =
    matchedDoctor &&
    matchedDoctor.hospitalIds.includes(hospital.id) &&
    (!specialty || matchedDoctor.specialtyId === specialty.id)
      ? matchedDoctor
      : null;
  const doctorNotAvailableNotice =
    extracted.doctorName && !doctor
      ? ` Não encontrei "${extracted.doctorName}" disponível nessa unidade/especialidade — vou considerar "qualquer médico disponível".`
      : "";

  const title = computeTitle(extracted.type, specialty?.name ?? null, examType?.name ?? null, surgeryType?.name ?? null);

  const draft: AppointmentDraft = {
    type: extracted.type,
    title,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    // Igual ao que `NovoAgendamento.tsx` já grava hoje: `specialtyId` só é
    // preenchido para consulta/online. Para exame/cirurgia, o schema real
    // de `appointments` NÃO guarda o ID do exame/cirurgia (só o nome,
    // já embutido em `title` acima) — mesma limitação documentada em
    // `AppointmentPrefill` (mobile/src/types/index.ts).
    specialtyId: specialty?.id ?? null,
    doctorId: doctor?.id ?? null,
    doctorName: doctor?.name ?? null,
    dateIso,
    notes: null,
  };

  // Conflito de horário é verificado uma única vez, de forma autoritativa,
  // dentro da ferramenta MCP `create_appointment` — no momento da
  // confirmação (`confirmAppointmentDraft`, abaixo), não aqui. Checar aqui
  // também exigiria uma segunda ferramenta MCP só para isso e ainda
  // correria o risco de ficar desatualizada entre o rascunho e a
  // confirmação (o paciente pode demorar para confirmar); o momento que
  // realmente importa para a correção é imediatamente antes de gravar.

  return {
    message:
      `Encontrei tudo para o seu agendamento: ${title}, em ${hospital.name}` +
      `${doctor ? ` com ${doctor.name}` : ""}, em ${formatDateTime(dateIso)}.${doctorNotAvailableNotice} ` +
      `Confirma a criação deste agendamento?`,
    requiresConfirmation: true,
    draft,
  };
}

function formatMissingList(missing: string[]): string {
  if (missing.length === 0) return "mais alguns detalhes";
  if (missing.length === 1) return missing[0];
  return `${missing.slice(0, -1).join(", ")} e ${missing[missing.length - 1]}`;
}

/**
 * Confirma e grava um `AppointmentDraft` — a ÚNICA função deste arquivo
 * que aciona a ferramenta MCP de escrita (`create_appointment`). Nunca é
 * chamada a partir de uma mensagem em linguagem natural; só a partir do
 * corpo `{ confirmDraft }` da rota (o app reenvia, sem alteração, o mesmo
 * objeto `draft` que recebeu na resposta anterior).
 *
 * Revalida a FORMA do rascunho (Zod) — nunca confia cegamente em um corpo
 * vindo do cliente, mesmo sendo o próprio backend quem o gerou
 * originalmente.
 */
export async function confirmAppointmentDraft(patientUid: string, rawDraft: unknown): Promise<ScheduleAgentResult> {
  const parsed = appointmentDraftSchema.safeParse(rawDraft);
  if (!parsed.success) {
    return {
      message: "Não consegui confirmar esse agendamento — os dados enviados estão em um formato inesperado. Tente pedir o agendamento novamente.",
      needsInfo: true,
    };
  }

  const draft = parsed.data;

  const result = await callCreateAppointment({
    patientUid,
    type: draft.type,
    title: draft.title,
    hospitalId: draft.hospitalId,
    hospitalName: draft.hospitalName,
    specialtyId: draft.specialtyId,
    doctorId: draft.doctorId,
    doctorName: draft.doctorName,
    date: draft.dateIso,
    notes: draft.notes,
  });

  if (result.conflict) {
    return {
      message: "Esse horário acabou de ser ocupado por outro agendamento. Por favor, escolha outro horário e peça novamente.",
      created: false,
      conflict: true,
    };
  }

  return {
    message: `Agendamento confirmado: ${result.appointment.title} em ${formatDateTime(result.appointment.date)} (${result.appointment.hospitalName}).`,
    created: true,
    appointment: result.appointment,
  };
}
