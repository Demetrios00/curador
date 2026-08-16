import { callFindNearbyUnits, type NearbyUnit } from "../../mcp/clients/unitsMcpClient";
import { formatDistance } from "../../utils/geo";

export interface UnitsAgentResult {
  message: string;
  nearestUnits: NearbyUnit[];
}

/**
 * Agente de Unidades (Fase 6 — último da fase).
 *
 * Diferente dos três agentes anteriores, não recebe `patientUid` como
 * única entrada: precisa também da localização ATUAL do paciente
 * (`latitude`/`longitude`), que só existe no dispositivo (GPS) — nunca é
 * salva no Firestore. Por isso `location` chega como parâmetro explícito,
 * vindo do corpo da requisição HTTP (ver `orchestrator.controller.ts`).
 *
 * Quando `location` está ausente, o agente responde de forma controlada em
 * vez de falhar — mesma filosofia dos demais agentes diante de dado
 * ausente (Seção 21 do projeto: tratamento de erros/observabilidade).
 */
export async function handleUnitsRequest(
  location: { latitude: number; longitude: number } | null
): Promise<UnitsAgentResult> {
  if (!location) {
    return {
      message: "Para encontrar unidades próximas, preciso da sua localização. Ative o compartilhamento de localização no app e tente novamente.",
      nearestUnits: [],
    };
  }

  const { units, skippedWithoutCoordinates } = await callFindNearbyUnits(location.latitude, location.longitude, 5);

  if (units.length === 0) {
    return {
      message: "Não encontrei nenhuma unidade de saúde com localização cadastrada no momento.",
      nearestUnits: [],
    };
  }

  return {
    message: buildMessage(units, skippedWithoutCoordinates),
    nearestUnits: units,
  };
}

function buildMessage(units: NearbyUnit[], skippedWithoutCoordinates: number): string {
  const nearest = units[0];
  const nearestLine = `A unidade mais próxima de você é ${nearest.name} (${nearest.city}/${nearest.state}), a ${formatDistance(nearest.distanceKm)}.`;

  const others = units.slice(1, 3);
  const othersLine =
    others.length > 0
      ? ` Também próximas: ${others.map((u) => `${u.name} (${formatDistance(u.distanceKm)})`).join(", ")}.`
      : "";

  const skippedNote =
    skippedWithoutCoordinates > 0
      ? ` (${skippedWithoutCoordinates} unidade(s) sem localização cadastrada não pôde(ram) ser considerada(s).)`
      : "";

  return `${nearestLine}${othersLine}${skippedNote}`;
}
