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
