import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Prescription } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { Pill, ShieldAlert } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Ideia 2 — extensão de escopo (03/09/2026): esta tela estava "aceitável"
 * no teste real graças aos componentes compartilhados (`Card`/`Badge`), mas
 * o fundo da tela e textos soltos ainda eram cores fixas. Padronizada por
 * completo nesta rodada, junto com Resultados e Encaminhamentos.
 */
export default function Prescricoes() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "prescriptions"),
        where("patientUid", "==", user.uid),
        orderBy("date", "desc")
      );
      const snap = await getDocs(q);
      setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PageHeader title="Prescrições ativas" subtitle="Medicamentos prescritos por seus médicos" showBack />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1aaa86"]} tintColor="#1aaa86" />
        }
      >
        {loading ? (
          <LoadingSpinner />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhuma prescrição ativa"
            icon={<Pill size={40} color={colors.textSubtle} />}
          />
        ) : (
          items.map((p) => (
            <Card key={p.id} style={{ borderRadius: 16, padding: 16, gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 }}>
                  <View style={{
                    width: 48, height: 48, borderRadius: 12,
                    backgroundColor: "rgba(26,170,134,0.1)", alignItems: "center", justifyContent: "center",
                  }}>
                    <Pill size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
                      {p.medications[0]?.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                      {p.doctorName}{p.specialty ? ` · ${p.specialty}` : ""}
                    </Text>
                  </View>
                </View>
                {p.controlled ? (
                  <Badge variant="destructive">
                    Controlado
                  </Badge>
                ) : null}
              </View>

              <View style={{ borderRadius: 10, backgroundColor: colors.surfaceAlt, padding: 12, gap: 6 }}>
                {p.medications.map((m, i) => (
                  <View key={i} style={{ gap: 2 }}>
                    <Text style={{ fontSize: 12, color: colors.text }}>
                      <Text style={{ fontWeight: "600" }}>Dose: </Text>{m.dosage}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.text }}>
                      <Text style={{ fontWeight: "600" }}>Frequência: </Text>{m.frequency}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.text }}>
                      <Text style={{ fontWeight: "600" }}>Duração: </Text>{m.duration}
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={{ fontSize: 11, color: colors.textSubtle }}>
                Prescrito em {new Date(p.date).toLocaleDateString("pt-BR")}
              </Text>
              {p.notes ? (
                <Text style={{ fontSize: 12, color: colors.textMuted }}>{p.notes}</Text>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
