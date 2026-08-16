import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { Coords, FALLBACK_LOCATION } from "@/lib/geo";

interface State {
  coords: Coords;
  source: "gps" | "fallback";
  loading: boolean;
  error?: string;
}

export function useGeolocation(): State {
  const [state, setState] = useState<State>({
    coords: FALLBACK_LOCATION,
    source: "fallback",
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) {
          if (!cancelled) {
            setState({ coords: FALLBACK_LOCATION, source: "fallback", loading: false });
          }
          return;
        }
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setState({
            coords: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
            source: "gps",
            loading: false,
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          setState({
            coords: FALLBACK_LOCATION,
            source: "fallback",
            loading: false,
            error: e?.message,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
