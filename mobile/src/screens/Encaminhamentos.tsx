import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Referral } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { ChevronRight, FileText, Scissors, Stethoscope } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";

const statusVariant: Record<string, "warning" | "default" | "success"> = {
  pendente: "warning",
  agendado: "default",
  concluido: "success",
};

export default function Encaminhamentos() {
  const { user } = useAuth();
  // `useNavigation` genérico (mesmo padrão de `Home.tsx`/`goToTab`): esta
  // tela vive dentro de `ResultadosStack`, mas precisa navegar para a aba
  // "Agendar" (Tab pai) com parâmetros — cruzar essa fronteira com tipagem
  // estrita de uma única stack não se aplica aqui.
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "referrals"),
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

  /**
   * Ideia 3 (claude/avaliacao-evolucao-pre-fase8.md): ao tocar num
   * encaminhamento, abre "Novo agendamento" com tipo + especialidade
   * pré-preenchidos. `referrals` não tem unidade/médico de execução, então
   * esses campos continuam sendo escolha do paciente em `NovoAgendamento`.
   */
  const handlePressReferral = (r: Referral) => {
    navigation.navigate("Agendar", {
      prefill: { type: r.type, specialtyName: r.specialty, sourceReferralId: r.id },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <PageHeader
        title="Encaminhamentos"
        subtitle="Indicações para especialistas e procedimentos"
        showBack
      />
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
            title="Nenhum encaminhamento"
            icon={<FileText size={40} color="#9ca3af" />}
          />
        ) : (
          items.map((r) => {
            const Icon = r.type === "cirurgia" ? Scissors : Stethoscope;
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => handlePressReferral(r)}
                activeOpacity={0.8}
                accessibilityLabel={`Agendar a partir do encaminhamento de ${r.specialty}`}
              >
                <Card style={{ borderRadius: 16, padding: 16, gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 }}>
                      <View style={{
                        width: 48, height: 48, borderRadius: 12,
                        backgroundColor: "rgba(14,94,112,0.1)", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={20} color="#0e5e70" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>
                          {r.specialty}
                        </Text>
                        <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                          {r.type === "cirurgia" ? "Cirurgia" : "Consulta"} · Encaminhado por {r.doctorName}
                        </Text>
                      </View>
                    </View>
                    <Badge variant={statusVariant[r.status] ?? "secondary"}>{r.status}</Badge>
                  </View>
                  {r.reason ? (
                    <View style={{ borderRadius: 10, backgroundColor: "rgba(243,244,246,0.8)", padding: 12 }}>
                      <Text style={{ fontSize: 12, color: "#374151" }}>
                        <Text style={{ fontWeight: "600" }}>Motivo: </Text>{r.reason}
                      </Text>
                    </View>
                  ) : null}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 11, color: "#9ca3af" }}>
                      Emitido em {new Date(r.date).toLocaleDateString("pt-BR")}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: "#1aaa86" }}>Agendar</Text>
                      <ChevronRight size={14} color="#1aaa86" />
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
