import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/config/firebase";
import { Hospital } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { Building2, MapPin, Phone } from "lucide-react-native";
import { useGeolocation } from "@/hooks/useGeolocation";
import { formatDistance, haversineDistanceKm } from "@/lib/geo";
import { useTheme } from "@/contexts/ThemeContext";

interface HospitalWithDistance extends Hospital {
  distanceKm: number;
}

/**
 * Ideia 2 — extensão de escopo (03/09/2026): esta tela ficava fora do
 * escopo reduzido original (`claude/ideia2-tema-dark-light-proposta.md`).
 * No teste real, o resultado foi pior do que o previsto na proposta: o
 * `Card` (componente compartilhado, já themeado) escurece corretamente,
 * mas o nome de cada unidade usava `color: "#111827"` fixo — um texto
 * escuro pensado para fundo claro — ficando praticamente ilegível sobre o
 * fundo escuro do card. O fundo da própria tela (`View` raiz) também
 * ficava sempre `#f9fafb` (claro), independente do tema. Retemado por
 * completo nesta rodada, junto com Novo Agendamento e Agente IA.
 */
export default function UnidadesProximas() {
  const { colors } = useTheme();
  const { coords, source, loading: geoLoading } = useGeolocation();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "hospitals"));
      setHospitals(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const ranked: HospitalWithDistance[] = useMemo(() => {
    return hospitals
      .filter((h) => typeof h.lat === "number" && typeof h.lng === "number")
      .map((h) => ({
        ...h,
        distanceKm: haversineDistanceKm(coords, {
          latitude: h.lat as number,
          longitude: h.lng as number,
        }),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [hospitals, coords]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PageHeader
        title="Unidades próximas"
        variant="hero"
        subtitle={
          source === "gps"
            ? "Localização atual detectada"
            : "Usando localização padrão: Dois Vizinhos/PR"
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1aaa86"]} tintColor="#1aaa86" />
        }
      >
        {loading || geoLoading ? (
          <LoadingSpinner />
        ) : ranked.length === 0 ? (
          <EmptyState
            title="Nenhuma unidade encontrada"
            description="Nenhuma unidade com coordenadas cadastradas."
            icon={<Building2 size={32} color={colors.textSubtle} />}
          />
        ) : (
          ranked.map((h) => (
            <Card key={h.id} style={{ borderRadius: 16, padding: 16, flexDirection: "row", gap: 12 }}>
              <View style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                backgroundColor: "rgba(26,170,134,0.1)", alignItems: "center", justifyContent: "center",
              }}>
                <Building2 size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, flex: 1 }} numberOfLines={2}>
                    {h.name}
                  </Text>
                  <Badge variant={h.distanceKm <= 5 ? "default" : "secondary"}>
                    {formatDistance(h.distanceKm)}
                  </Badge>
                </View>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 6 }}>
                  <MapPin size={12} color={colors.textSubtle} style={{ marginTop: 1 }} />
                  <Text style={{ fontSize: 12, color: colors.textMuted, flex: 1 }} numberOfLines={2}>
                    {h.address} — {h.city}/{h.state}
                  </Text>
                </View>
                {h.phone ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Phone size={11} color={colors.textSubtle} />
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{h.phone}</Text>
                  </View>
                ) : null}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
