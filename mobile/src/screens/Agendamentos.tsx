import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Appointment } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Tabs } from "@/components/Tabs";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { Calendar, MapPin, Plus, Stethoscope } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AgendamentosStackParamList } from "@/navigation/StacksNavigator";

const statusVariant: Record<string, "warning" | "default" | "success" | "destructive"> = {
  agendado: "warning",
  confirmado: "default",
  concluido: "success",
  cancelado: "destructive",
};

export default function Agendamentos() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AgendamentosStackParamList>>();
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("proximos");
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "appointments"),
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

  const now = Date.now();
  

  const proximos = items.filter((a) => new Date(a.date).getTime() >= now);
  const historico = items.filter((a) => new Date(a.date).getTime() < now);
  const displayed = activeTab === "proximos" ? proximos : historico;

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <PageHeader
        title="Agendamentos"
        subtitle="Suas consultas, exames e cirurgias"
        right={
          <TouchableOpacity
            onPress={() => navigation.navigate("NovoAgendamento")}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: "#1aaa86", alignItems: "center", justifyContent: "center",
            }}
            accessibilityLabel="Novo agendamento"
          >
            <Plus size={20} color="#fff" />
          </TouchableOpacity>
        }
      />

      <View style={{ paddingHorizontal: 20, paddingTop: 20, flex: 1 }}>
        <Tabs
          tabs={[
            { key: "proximos", label: "Próximos" },
            { key: "historico", label: "Histórico" },
          ]}
          activeKey={activeTab}
          onChange={setActiveTab}
        />

        <ScrollView
          style={{ flex: 1, marginTop: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1aaa86"]} tintColor="#1aaa86" />
          }
        >
          {loading ? (
            <LoadingSpinner />
          ) : displayed.length === 0 ? (
            <EmptyState
              title={activeTab === "proximos" ? "Nenhum compromisso" : "Nenhum histórico"}
              description={
                activeTab === "proximos"
                  ? "Agende sua próxima consulta ou exame."
                  : "Seus atendimentos passados aparecerão aqui."
              }
              icon={<Calendar size={40} color="#9ca3af" />}
            />
          ) : (
            <View style={{ gap: 12, paddingBottom: 32 }}>
              {displayed.map((a) => (
                <AppointmentCard key={a.id} a={a} />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function AppointmentCard({ a }: { a: Appointment }) {
  const d = new Date(a.date);
  return (
    <Card style={{ borderRadius: 16, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, flex: 1 }}>
          <View style={{
            width: 48, height: 48, borderRadius: 12,
            backgroundColor: "rgba(26,170,134,0.1)", alignItems: "center", justifyContent: "center",
          }}>
            <Stethoscope size={20} color="#1aaa86" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>{a.title}</Text>
            {a.doctorName ? (
              <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{a.doctorName}</Text>
            ) : null}
          </View>
        </View>
        <Badge variant={statusVariant[a.status] ?? "secondary"}>{a.status}</Badge>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Calendar size={13} color="#9ca3af" />
          <Text style={{ fontSize: 12, color: "#6b7280" }}>
            {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
            {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <MapPin size={13} color="#9ca3af" />
          <Text style={{ fontSize: 12, color: "#6b7280" }}>{a.hospitalName}</Text>
        </View>
      </View>

      {(a as any).preparation ? (
        <View style={{ borderRadius: 10, backgroundColor: "rgba(245,158,11,0.1)", padding: 12 }}>
          <Text style={{ fontSize: 12, color: "#111827" }}>
            <Text style={{ fontWeight: "600", color: "#f59e0b" }}>Preparo: </Text>
            {(a as any).preparation}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}
