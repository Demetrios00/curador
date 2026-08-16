/**
 * Fórmula de distância (Haversine) e formatação — cópia fiel de `geo.ts` do
 * app mobile (mesma constante, mesma fórmula, mesmo fallback). Não é
 * lógica de negócio duplicada em dois lugares divergentes: é o cálculo de
 * proximidade MOVIDO para o backend, como já recomendava a auditoria da
 * Fase 0 ("mover o cálculo de proximidade para o backend/agente, para que
 * a tela mobile deixe de conter essa lógica de negócio"). Não é possível
 * importar o arquivo TypeScript do app React Native diretamente aqui — os
 * dois são processos/runtimes separados — por isso a fórmula (uma função
 * matemática pura e estável, sem risco real de divergir) foi replicada.
 * `UnidadesProximas.tsx` mantém sua própria cópia até uma eventual
 * integração do app com este agente (fora do escopo desta fase).
 */
export interface Coords {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_KM = 6371;

const toRad = (value: number) => (value * Math.PI) / 180;

export function haversineDistanceKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
