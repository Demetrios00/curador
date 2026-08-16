import { getAdminFirestore } from "../firebase/admin";

/**
 * Repositório da coleção `hospitals` (nome real no Firestore atual do
 * CuraDor — ver auditoria Fase 0; corresponde conceitualmente a "units" no
 * artigo do TCC). Mantido isolado para que controllers/agentes nunca
 * chamem o Firestore diretamente — mesmo princípio que falta hoje nas
 * telas do app mobile (débito técnico identificado na auditoria).
 */
export interface HospitalSummary {
  id: string;
  name: string;
}

export async function countHospitals(): Promise<number> {
  const snapshot = await getAdminFirestore().collection("hospitals").count().get();
  return snapshot.data().count;
}

export async function listHospitalsSample(limit = 5): Promise<HospitalSummary[]> {
  const snapshot = await getAdminFirestore().collection("hospitals").limit(limit).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    name: (doc.data().name as string | undefined) ?? "(sem nome)",
  }));
}

/** Schema real de `hospitals` (confirmado em `types/index.ts`) — `lat`/`lng` são opcionais no Firestore. */
export interface HospitalWithCoords {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  services: string[];
  lat: number;
  lng: number;
}

/**
 * Lê TODAS as unidades e filtra apenas as que têm `lat`/`lng` cadastrados —
 * sem coordenadas não há como calcular distância. O total ignorado é
 * devolvido separadamente (`skippedWithoutCoordinates`), em vez de
 * descartado silenciosamente, para que o Agente de Unidades possa avisar
 * quando isso afetar o resultado.
 */
export async function listHospitalsWithCoordinates(): Promise<{
  hospitals: HospitalWithCoords[];
  skippedWithoutCoordinates: number;
}> {
  const snapshot = await getAdminFirestore().collection("hospitals").get();

  const hospitals: HospitalWithCoords[] = [];
  let skippedWithoutCoordinates = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (typeof data.lat === "number" && typeof data.lng === "number") {
      hospitals.push({
        id: doc.id,
        name: data.name ?? "(sem nome)",
        city: data.city ?? "",
        state: data.state ?? "",
        address: data.address ?? "",
        services: Array.isArray(data.services) ? data.services : [],
        lat: data.lat,
        lng: data.lng,
      });
    } else {
      skippedWithoutCoordinates++;
    }
  }

  return { hospitals, skippedWithoutCoordinates };
}
