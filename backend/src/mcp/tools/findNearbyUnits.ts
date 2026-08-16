import { z } from "zod";

import { listHospitalsWithCoordinates } from "../../repositories/hospitals.repository";
import { haversineDistanceKm } from "../../utils/geo";

export const FIND_NEARBY_UNITS_TOOL_NAME = "find_nearby_units";

/**
 * Diferente de `list_user_appointments`/`get_exam_results`, esta ferramenta
 * NÃO recebe `patientUid`: unidades de saúde são dado público de
 * referência — qualquer paciente pode consultar qualquer unidade, não há
 * necessidade de escopo por paciente (decisão apresentada e aprovada antes
 * da implementação).
 */
export const findNearbyUnitsInputSchema = {
  latitude: z.number().min(-90).max(90).describe("Latitude atual do paciente."),
  longitude: z.number().min(-180).max(180).describe("Longitude atual do paciente."),
  limit: z.number().int().min(1).max(20).optional().describe("Quantidade máxima de unidades a retornar (padrão: 5)."),
};

export async function findNearbyUnitsHandler({
  latitude,
  longitude,
  limit,
}: {
  latitude: number;
  longitude: number;
  limit?: number;
}) {
  const { hospitals, skippedWithoutCoordinates } = await listHospitalsWithCoordinates();

  const units = hospitals
    .map((h) => ({
      id: h.id,
      name: h.name,
      city: h.city,
      state: h.state,
      address: h.address,
      services: h.services,
      distanceKm: haversineDistanceKm({ latitude, longitude }, { latitude: h.lat, longitude: h.lng }),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit ?? 5);

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ units, skippedWithoutCoordinates }) }],
  };
}
