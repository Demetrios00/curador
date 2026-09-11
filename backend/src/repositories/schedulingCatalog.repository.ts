import { getAdminFirestore } from "../firebase/admin";
import { withTimeout } from "../utils/withTimeout";
import type { AppointmentRecord } from "./appointments.repository";

/**
 * Repositório de apoio à Ideia 5b (criação de agendamento via linguagem
 * natural, `claude/avaliacao-evolucao-pre-fase8.md`).
 *
 * Lê os catálogos que `NovoAgendamento.tsx` (mobile) já consulta hoje
 * (`hospitals`, `specialties`, `doctors`, `examTypes`, `surgeryTypes`) —
 * schema confirmado ali e em `mobile/src/types/index.ts`, não inventado
 * aqui. O Agente de Agendamentos precisa dos mesmos catálogos no backend
 * para resolver nomes ditos em linguagem natural (ex.: "Cardiologia",
 * "Hospital Prime Care") contra IDs reais, do mesmo jeito que o app mobile
 * já faz para os prefills de Encaminhamento/Remarcação (Ideias 3 e 5).
 */

export interface CatalogHospital {
  id: string;
  name: string;
  city: string;
  state: string;
}

export interface CatalogSpecialty {
  id: string;
  name: string;
}

export interface CatalogDoctor {
  id: string;
  name: string;
  specialtyId: string;
  hospitalIds: string[];
}

export interface CatalogExamType {
  id: string;
  name: string;
}

export interface CatalogSurgeryType {
  id: string;
  name: string;
}

export interface SchedulingCatalog {
  hospitals: CatalogHospital[];
  specialties: CatalogSpecialty[];
  doctors: CatalogDoctor[];
  examTypes: CatalogExamType[];
  surgeryTypes: CatalogSurgeryType[];
}

export async function listSchedulingCatalog(): Promise<SchedulingCatalog> {
  const db = getAdminFirestore();

  const [hospitalsSnap, specialtiesSnap, doctorsSnap, examTypesSnap, surgeryTypesSnap] = await Promise.all([
    withTimeout(db.collection("hospitals").get(), 8000, "schedulingCatalog.hospitals"),
    withTimeout(db.collection("specialties").get(), 8000, "schedulingCatalog.specialties"),
    withTimeout(db.collection("doctors").get(), 8000, "schedulingCatalog.doctors"),
    withTimeout(db.collection("examTypes").get(), 8000, "schedulingCatalog.examTypes"),
    withTimeout(db.collection("surgeryTypes").get(), 8000, "schedulingCatalog.surgeryTypes"),
  ]);

  return {
    hospitals: hospitalsSnap.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, name: data.name ?? "", city: data.city ?? "", state: data.state ?? "" };
    }),
    specialties: specialtiesSnap.docs.map((doc) => ({ id: doc.id, name: doc.data().name ?? "" })),
    doctors: doctorsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name ?? "",
        specialtyId: data.specialtyId ?? "",
        hospitalIds: Array.isArray(data.hospitalIds) ? data.hospitalIds : [],
      };
    }),
    examTypes: examTypesSnap.docs.map((doc) => ({ id: doc.id, name: doc.data().name ?? "" })),
    surgeryTypes: surgeryTypesSnap.docs.map((doc) => ({ id: doc.id, name: doc.data().name ?? "" })),
  };
}

/**
 * Conjunto de status considerados "ativos" para efeito de conflito de
 * horário — um agendamento cancelado ou já concluído não ocupa mais o
 * horário. Mesmos 4 valores do schema real (`appointments.repository.ts`).
 */
const ACTIVE_STATUSES = ["agendado", "confirmado"];

/**
 * Verifica se já existe um agendamento ATIVO do mesmo médico, na mesma
 * unidade, no mesmo instante exato (`dateIso`).
 *
 * Limitação conhecida (documentada, não escondida — Seção 24 do projeto):
 * só verifica colisão quando um médico específico foi indicado
 * (`doctorId`). Quando o paciente aceita "qualquer médico disponível" —
 * mesma opção que `NovoAgendamento.tsx` já oferece — não há como saber
 * qual médico seria de fato alocado, então nenhuma verificação de conflito
 * é feita nesse caso (mesmo risco que o formulário manual já aceita hoje).
 * Também não há garantia transacional: entre esta checagem e a escrita em
 * `createAppointmentRecord`, outro agendamento poderia ser criado
 * concorrentemente — por isso a ferramenta MCP de escrita (`create_appointment`)
 * refaz esta mesma verificação imediatamente antes de gravar (ver
 * `mcp/tools/createAppointment.ts`), reduzindo (não eliminando) a janela de
 * corrida. Uma garantia forte exigiria transação do Firestore com um
 * documento de "slot" dedicado — fora do escopo desta primeira versão.
 */
export async function hasConflictingAppointment(params: {
  hospitalId: string;
  doctorId: string | null;
  dateIso: string;
}): Promise<boolean> {
  if (!params.doctorId) return false;

  const snapshot = await withTimeout(
    getAdminFirestore()
      .collection("appointments")
      .where("hospitalId", "==", params.hospitalId)
      .where("doctorId", "==", params.doctorId)
      .where("date", "==", params.dateIso)
      .get(),
    8000,
    "schedulingCatalog.hasConflictingAppointment"
  );

  return snapshot.docs.some((doc) => ACTIVE_STATUSES.includes(doc.data().status));
}

export interface CreateAppointmentInput {
  patientUid: string;
  type: string;
  title: string;
  hospitalId: string;
  hospitalName: string;
  specialtyId: string | null;
  doctorId: string | null;
  doctorName: string | null;
  date: string;
  notes: string | null;
}

/**
 * Grava um agendamento novo. Mesmo formato de documento que
 * `NovoAgendamento.tsx` já escreve hoje via `addDoc` direto do cliente
 * (Firestore) — aqui é o backend, via Firebase Admin, quem grava, mas o
 * schema do documento é idêntico, para não criar dois formatos
 * divergentes da mesma coleção.
 */
export async function createAppointmentRecord(input: CreateAppointmentInput): Promise<AppointmentRecord> {
  const db = getAdminFirestore();
  const docData = {
    patientUid: input.patientUid,
    type: input.type,
    title: input.title,
    doctorId: input.doctorId,
    doctorName: input.doctorName,
    specialtyId: input.specialtyId,
    hospitalId: input.hospitalId,
    hospitalName: input.hospitalName,
    date: input.date,
    status: "agendado" as const,
    notes: input.notes,
    createdAt: Date.now(),
  };

  const ref = await withTimeout(db.collection("appointments").add(docData), 8000, "schedulingCatalog.createAppointment");

  return {
    id: ref.id,
    patientUid: docData.patientUid,
    type: docData.type,
    title: docData.title,
    doctorName: docData.doctorName,
    hospitalName: docData.hospitalName,
    date: docData.date,
    status: docData.status,
    notes: docData.notes,
  };
}
