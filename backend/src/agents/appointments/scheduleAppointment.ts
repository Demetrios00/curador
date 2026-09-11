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

export interface ScheduleAgentResult {
  message: string;
  needsInfo?: true;
  requiresConfirmation?: true;
  draft?: AppointmentDraft;
  created?: boolean;
  conflict?: boolean;
  appointment?: AppointmentRecord;
}

/**
 * Classificador dedicado "consultar vs. criar", separado da extração de
 * campos (`extractAppointmentFields`) — responsabilidade única, prompt
 * pequeno e fácil de auditar isoladamente (Seção 21 do projeto: funções
 * pequenas). Roda ANTES da extração para não gastar uma extração completa
 * em mensagens que são só consulta (o caminho já validado nas Fases 4/5a).
 */
export async function classifyAppointmentAction(message: string): Promise<"QUERY" | "CREATE"> {
  const raw = await llmProvider.complete([
    {
      role: "system",
      content:
        'Classifique a mensagem de um paciente sobre agendamentos em EXATAMENTE uma destas duas categorias: ' +
        '"QUERY" (perguntar sobre agendamentos que já existem — consultas, próximos compromissos, status, histórico) ou ' +
        '"CREATE" (pedir para marcar/agendar algo novo). Responda SOMENTE com o JSON {"action":"QUERY"} ou {"action":"CREATE"}, sem nenhum texto antes ou depois.',
    },
    { role: "user", content: message },
  ]);

  const match = raw.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(match ? match[0] : raw) as { action?: unknown };
    return parsed.action === "CREATE" ? "CREATE" : "QUERY";
  } catch {
    return "QUERY";
  }
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

const EXTRACTION_PROMPT = `Você extrai dados estruturados de um pedido de agendamento de saúde em linguagem natural, em português do Brasil.

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
    { role: "system", content: EXTRACTION_PROMPT },
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
        `Pode reformular incluindo isso em uma única mensagem?`,
      needsInfo: true,
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
