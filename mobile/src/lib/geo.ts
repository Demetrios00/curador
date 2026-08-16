// Geolocation utilities — Haversine distance + fixed fallback location.

export interface Coords {
  latitude: number;
  longitude: number;
}

// Fallback fixo: Dois Vizinhos - PR, Brasil (CEP 85660-000)
export const FALLBACK_LOCATION: Coords = {
  latitude: -25.7395,
  longitude: -53.0553,
};

const EARTH_RADIUS_KM = 6371;

const toRad = (value: number) => (value * Math.PI) / 180;

export function haversineDistanceKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
