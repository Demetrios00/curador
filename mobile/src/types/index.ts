// Modelos do Firestore (NoSQL) — CuraDor

export type Gender = "M" | "F" | "Outro";
export type AppointmentType = "consulta" | "exame" | "cirurgia" | "online";
export type AppointmentStatus = "agendado" | "confirmado" | "concluido" | "cancelado";
export type ResultType = "exame" | "consulta";

export interface Patient {
  uid: string;
  fullName: string;
  cpf: string;
  birthDate: string; // ISO date
  gender: Gender;
  phone: string;
  email: string;
  insurance?: string;        // convênio
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
  };
  photoURL?: string;
  createdAt: number;
}

export interface Hospital {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  cnpj?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  services?: string[];
}

export interface ExamType {
  id: string;
  name: string;
  category?: string;
  preparation?: string;
}

export interface SurgeryType {
  id: string;
  name: string;
  category?: string;
}

export interface Specialty {
  id: string;
  name: string;
  icon?: string;
}

export interface Doctor {
  id: string;
  name: string;
  crm: string;
  specialtyId: string;
  hospitalIds: string[];
  photoURL?: string;
  rating?: number;
}

export interface Appointment {
  id: string;
  patientUid: string;
  type: AppointmentType;
  title: string;             // "Consulta Cardiologia" / "Hemograma"
  doctorId?: string;
  doctorName?: string;
  specialtyId?: string;
  hospitalId: string;
  hospitalName: string;
  date: string;              // ISO datetime
  status: AppointmentStatus;
  notes?: string;
  preparation?: string;      // instruções (jejum, etc.)
  createdAt: number;
}

export interface MedicalResult {
  id: string;
  patientUid: string;
  type: ResultType;
  title: string;             // "Hemograma completo"
  doctorName?: string;
  hospitalName: string;
  date: string;              // ISO date
  fileURL?: string;          // PDF no Storage
  summary?: string;
  status: "disponivel" | "processando";
}

export interface Prescription {
  id: string;
  patientUid: string;
  doctorName: string;
  specialty?: string;
  date: string;              // ISO date
  controlled?: boolean;
  medications: { name: string; dosage: string; frequency: string; duration: string }[];
  notes?: string;
}

export interface Referral {
  id: string;
  patientUid: string;
  type: "consulta" | "cirurgia";
  specialty: string;
  reason?: string;
  doctorName: string;
  date: string;              // ISO
  status: "pendente" | "agendado" | "concluido";
  notes?: string;
}

/**
 * Dados enviados de `Encaminhamentos` para `NovoAgendamento` ao tocar em um
 * encaminhamento (Ideia 3 avaliada em claude/avaliacao-evolucao-pre-fase8.md).
 * Cobre apenas tipo + especialidade — `referrals` não tem unidade nem médico
 * de execução, então esses campos continuam sendo escolha do paciente.
 */
export interface ReferralPrefill {
  type: "consulta" | "cirurgia";
  /**
   * Nome da especialidade do encaminhamento (ex.: "Cardiologia"). Só é usado
   * para casar com `specialties` quando `type === "consulta"` — para
   * "cirurgia" não há campo equivalente em `NovoAgendamento` (o formulário
   * usa `surgeryTypes`, uma taxonomia diferente de procedimento específico,
   * ex.: "Cirurgia de ombro", não de especialidade médica), então nesse caso
   * o valor só é usado para exibir o aviso ao paciente.
   */
  specialtyName: string;
  /** ID do encaminhamento de origem — evita reaplicar o mesmo prefill repetidamente ao reabrir a aba "Agendar". */
  sourceReferralId: string;
}

/**
 * Dados enviados de `Agendamentos` para `NovoAgendamento` ao remarcar um
 * agendamento cancelado (Ideia 5, `claude/avaliacao-ajustes-2.0.md`).
 *
 * Diferente de `ReferralPrefill` (que só tem o NOME da especialidade, exigindo
 * casamento por texto), aqui o agendamento de origem já guarda os IDs reais de
 * `hospitalId`/`specialtyId`/`doctorId` — reaproveitados diretamente, sem
 * risco de casamento incorreto. A única exceção é `type === "exame" |
 * "cirurgia"`: `Appointment` não guarda `examTypeId`/`surgeryTypeId` (só usados
 * de forma transiente em `NovoAgendamento` para compor `title`), então para
 * esses dois tipos o casamento é por nome (`examOrSurgeryName` contra
 * `examTypes`/`surgeryTypes`), mesmo padrão já usado em `ReferralPrefill` para
 * especialidade.
 *
 * Deliberadamente NÃO inclui data/horário — a Ideia 5 exige que o paciente
 * escolha uma nova data/horário manualmente ao remarcar.
 */
export interface AppointmentPrefill {
  type: AppointmentType;
  hospitalId: string;
  /** Reaproveitado direto (sem casamento por nome) — só relevante para "consulta"/"online". */
  specialtyId?: string;
  /** Reaproveitado direto (sem casamento por nome), quando o agendamento original tinha médico definido. */
  doctorId?: string;
  /** Nome do exame/cirurgia (= `Appointment.title` para esses 2 tipos) — usado só quando `type` é "exame" ou "cirurgia", para casar contra `examTypes`/`surgeryTypes`. */
  examOrSurgeryName?: string;
  /** ID do agendamento de origem — evita reaplicar o mesmo prefill repetidamente ao reabrir a aba "Agendar". */
  sourceAppointmentId: string;
}
