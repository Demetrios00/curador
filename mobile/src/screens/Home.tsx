import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Appointment, MedicalResult } from "@/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Activity,
  AlertCircle,
  Bell,
  Calendar,
  ChevronRight,
  FileText,
  Heart,
  MapPin,
  MessageSquare,
  Moon,
  Plus,
  TrendingUp,
  Video,
} from "lucide-react-native";
import { Card } from "@/components/Card";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "@/navigation/StacksNavigator";

interface Stats {
  proximas: number;
  realizados: number;
  resultados: number;
  consultas: number;
  exames: number;
  prescricoes: number;
}

export default function Home() {
  const { patient, user } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [next, setNext] = useState<Appointment[]>([]);
  const [lastResult, setLastResult] = useState<MedicalResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<Stats>({
    proximas: 0, realizados: 0, resultados: 0, consultas: 0, exames: 0, prescricoes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      console.log("Fetching data for user:", user.uid);
      // const nowIso = new Date().toISOString();

      const now = new Date();
      const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();

      const upcomingQ = query(
        collection(db, "appointments"),
        where("patientUid", "==", user.uid),
        where("date", ">=", localIso),
        orderBy("date", "asc"),
        limit(10)
      );
      const upcomingSnap = await getDocs(upcomingQ);
      const upcoming = upcomingSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Appointment[];
      setNext(upcoming.slice(0, 2));

      const allApptsSnap = await getDocs(
        query(collection(db, "appointments"), where("patientUid", "==", user.uid))
      );
      const allAppts = allApptsSnap.docs.map((d) => d.data() as Appointment);

      const resultsSnap = await getDocs(
        query(collection(db, "results"), where("patientUid", "==", user.uid))
      ).catch(() => ({ size: 0, docs: [] } as any));

      const latestResultSnap = await getDocs(
        query(
          collection(db, "results"),
          where("patientUid", "==", user.uid),
          where("status", "==", "disponivel"),
          orderBy("date", "desc"),
          limit(1)
        )
      ).catch((error) => {
        console.log("Error fetching latest result snap", error);
        return { docs: [] } as any;
      });
      console.log("Latest result snap:", latestResultSnap);
      setLastResult(
        latestResultSnap.docs.length > 0
          ? ({ id: latestResultSnap.docs[0].id, ...latestResultSnap.docs[0].data() } as MedicalResult)
          : null
      );



      const prescSnap = await getDocs(
        query(collection(db, "prescriptions"), where("patientUid", "==", user.uid))
      ).catch(() => ({ size: 0 } as any));

      let realizados = allAppts.filter((a) => a.status === "concluido").length;
      let progressGoal = 5
      let progress = realizados / (progressGoal) * 100;
      if (progress > 100) progress = 100;
      setProgress(progress);

      setStats({
        proximas: upcoming.length,
        realizados: realizados,
        resultados: resultsSnap.size ?? 0,
        consultas: allAppts.filter((a: any) => a.type === "consulta").length,
        exames: allAppts.filter((a: any) => a.type === "exame").length,
        prescricoes: prescSnap.size ?? 0,
      });
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

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const firstName = patient?.fullName?.split(" ")[0] ?? "Paciente";
  const featured = next[0];

  const goToTab = (tabName: string, screen?: string) => {
    if (screen) {
      (navigation as any).navigate(tabName, { screen });
    } else {
      (navigation as any).navigate(tabName);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#f9fafb" }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#1aaa86"]} tintColor="#1aaa86" />
      }
    >
      {/* Hero */}
      <LinearGradient
        colors={["#1aaa86", "#0e5e70"]}
        style={{ paddingTop: insets.top + 16, paddingBottom: 72, paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
            }}>
              <Plus size={18} color="#fff" />
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>CuraD'Or</Text>
              <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", letterSpacing: 1 }}>
                HEALTH TECH
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 4 }}>
            <TouchableOpacity style={{ padding: 8 }} accessibilityLabel="Tema">
              <Moon size={20} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
            <TouchableOpacity style={{ padding: 8 }} accessibilityLabel="Notificações">
              <Bell size={20} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: "700", color: "#fff" }}>
            Olá, {firstName}! 👋
          </Text>
          <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
            Seu portfólio de saúde atualizado
          </Text>
        </View>

        {/* Stat tiles */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
          <StatTile value={stats.proximas} label="Próximas" />
          <StatTile value={stats.realizados} label="Realizados" />
          <StatTile value={stats.resultados} label="Resultados" />
        </View>
      </LinearGradient>

      {/* Featured card */}
      <View style={{ marginTop: -52, paddingHorizontal: 20 }}>
        {loading ? (
          <View style={{ height: 140, borderRadius: 16, backgroundColor: "#e5e7eb" }} />
        ) : featured ? (
          <FeaturedAppointment a={featured} onPress={() => navigation.navigate("Agendamentos")} />
        ) : (
          <View style={{ backgroundColor: "#fff", borderRadius: 16 }}>
            <Card style={{ borderRadius: 16, borderStyle: "dashed", padding: 24, alignItems: "center" }}>
              <Calendar size={32} color="#9ca3af" />
              <Text style={{ marginTop: 8, fontSize: 14, color: "#6b7280", textAlign: "center" }}>
                Você não tem agendamentos.
              </Text>
              <TouchableOpacity onPress={() => goToTab("Agendar")} style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#1aaa86" }}>Agendar agora</Text>
              </TouchableOpacity>
            </Card>
          </View>
        )}
      </View>

      {/* Alertas */}
      {lastResult && (
        <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AlertCircle size={16} color="#f59e0b" />
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>Alertas Importantes</Text>
          </View>
          <TouchableOpacity onPress={() => goToTab("Resultados")} activeOpacity={0.8}>
            <Card style={{
              elevation: 0,
              flexDirection: "row", alignItems: "center", gap: 12,
              borderRadius: 16, borderColor: "rgba(245,158,11,0.3)",
              backgroundColor: "rgba(245, 163, 20, 0.1)",
              padding: 16,
              shadowOpacity: 0,
            }}>
              <View style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: "rgba(245,158,11,0.2)", alignItems: "center", justifyContent: "center",
              }}>
                <AlertCircle size={16} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }} numberOfLines={1}>
                  {lastResult.title}
                </Text>
                <Text style={{ fontSize: 12, color: "#6b7280" }} numberOfLines={1}>
                  {lastResult.hospitalName} · {new Date(lastResult.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                </Text>
              </View>
              <ChevronRight size={16} color="#9ca3af" />
            </Card>
          </TouchableOpacity>
        </View>
      )}

      {/* Acesso Rápido */}
      <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 12 }}>
          Acesso Rápido
        </Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <QuickIcon icon={Calendar} label="Agendar" onPress={() => goToTab("Agendar")} />
          <QuickIcon icon={Video} label="Teleconsulta" onPress={() => goToTab("Agendar")} />
          <QuickIcon icon={FileText} label="Resultados" onPress={() => goToTab("Resultados")} />
          <QuickIcon icon={MessageSquare} label="Perfil" onPress={() => goToTab("Menu", "Perfil")} />
        </View>
      </View>

      {/* Métricas */}
      <View style={{ marginTop: 24, paddingHorizontal: 20, flexDirection: "row", gap: 12 }}>
        <Card style={{ flex: 1, borderRadius: 16, borderWidth: 0, backgroundColor: "#d1fae5", padding: 16 }}>
          <Activity size={20} color="#059669" />
          <Text style={{ marginTop: 12, fontSize: 14, fontWeight: "600", color: "#111827" }}>
            Suas Métricas
          </Text>
          <Text style={{ fontSize: 11, color: "#6b7280" }}>Últimos 30 dias</Text>
          <View style={{ marginTop: 12, gap: 4 }}>
            <MetricRow label="Consultas" value={stats.consultas} />
            <MetricRow label="Exames" value={stats.exames} />
            <MetricRow label="Prescrições" value={stats.prescricoes} />
          </View>
        </Card>
        <Card style={{ elevation: 0, flex: 1, borderRadius: 16, borderWidth: 0, backgroundColor: "rgba(26,170,134,0.05)", padding: 16 }}>
          <TrendingUp size={20} color="#1aaa86" />
          <Text style={{ marginTop: 12, fontSize: 14, fontWeight: "600", color: "#111827" }}>
            Saúde em Dia
          </Text>
          <Text style={{ fontSize: 11, color: "#6b7280" }}>Score de bem-estar</Text>
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: "#6b7280" }}>Progresso</Text>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#1aaa86" }}>{progress}%</Text>
            </View>
            <View style={{
              marginTop: 6, height: 6, borderRadius: 3,
              backgroundColor: "rgba(26,170,134,0.15)", overflow: "hidden",
            }}>
              <View style={{ width: `${progress}%`, height: "100%", borderRadius: 3, backgroundColor: "#1aaa86" }} />
            </View>
          </View>
        </Card>
      </View>

      {/* Próximos Agendamentos */}
      <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>
            Próximos Agendamentos
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Agendamentos")}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Text style={{ fontSize: 12, fontWeight: "500", color: "#1aaa86" }}>Ver todos</Text>
            <ChevronRight size={12} color="#1aaa86" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ gap: 8 }}>
            {[0, 1].map((i) => (
              <View key={i} style={{ height: 100, borderRadius: 16, backgroundColor: "#e5e7eb" }} />
            ))}
          </View>
        ) : next.length === 0 ? (
          <Card style={{ borderRadius: 16, borderStyle: "dashed", padding: 24, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: "#6b7280" }}>Nenhum agendamento futuro</Text>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {next.map((a) => <SmallAppointmentCard key={a.id} a={a} />)}
          </View>
        )}
      </View>

      {/* Explorar Mais */}
      <View style={{ marginTop: 24, paddingHorizontal: 20, marginBottom: 32 }}>
        <Card style={{ elevation: 0, borderRadius: 16, backgroundColor: "rgba(239, 245, 245, 0.3)", padding: 16, shadowOpacity: 0, borderColor: "rgb(217, 232, 230)" }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 12 }}>
            Explorar Mais
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ExploreItem label="Prescrições" icon={FileText} onPress={() => goToTab("Resultados", "Prescricoes")} />
            <ExploreItem label="Encaminhamentos" icon={FileText} onPress={() => goToTab("Resultados", "Encaminhamentos")} />
            <ExploreItem label="Unidades" icon={MapPin} onPress={() => goToTab("Menu", "UnidadesProximas")} />
            <ExploreItem label="Perfil" icon={MessageSquare} onPress={() => goToTab("Menu", "Perfil")} />
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.15)", padding: 12, alignItems: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "700", color: "#fff" }}>{value}</Text>
      <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>{label}</Text>
    </View>
  );
}

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  agendado: "#f59e0b",
  confirmado: "#1aaa86",
  concluido: "#6b7280",
  cancelado: "#ef4444",
};

function FeaturedAppointment({ a, onPress }: { a: Appointment; onPress: () => void }) {
  const date = new Date(a.date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const dateLabel = isTomorrow
    ? "Amanhã"
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const statusKey = (a as any).status ?? "agendado";
  const badgeColor = STATUS_COLOR[statusKey] ?? "#6b7280";
  const badgeLabel = STATUS_LABEL[statusKey] ?? statusKey;

  return (
    <Card style={{
      borderRadius: 16, borderLeftWidth: 4, borderLeftColor: "#1aaa86", padding: 16,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{
            backgroundColor: badgeColor, borderRadius: 999,
            paddingHorizontal: 10, paddingVertical: 2,
          }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff", textTransform: "uppercase" }}>
              {badgeLabel}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: "#6b7280" }}>{dateLabel}</Text>
        </View>
        <ChevronRight size={16} color="#9ca3af" />
      </View>
      <Text style={{ marginTop: 8, fontSize: 16, fontWeight: "700", color: "#111827" }}>{a.title}</Text>
      <Text style={{ marginTop: 4, fontSize: 14, color: "#6b7280" }}>
        {(a as any).professionalName ?? "Profissional"} ·{" "}
        {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
        <MapPin size={12} color="#6b7280" />
        <Text style={{ fontSize: 12, color: "#6b7280" }}>{a.hospitalName}</Text>
      </View>
      <TouchableOpacity
        onPress={onPress}
        style={{
          marginTop: 12, height: 40, borderRadius: 10,
          backgroundColor: "#1aaa86", alignItems: "center", justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>Ver detalhes</Text>
      </TouchableOpacity>
    </Card>
  );
}

function SmallAppointmentCard({ a }: { a: Appointment }) {
  const date = new Date(a.date);
  const isExam = (a as any).type === "exame";
  const Icon = isExam ? FileText : Heart;
  return (
    <Card style={{ borderRadius: 16, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{
          width: 44, height: 44, borderRadius: 12,
          backgroundColor: "rgba(26,170,134,0.1)", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={20} color="#1aaa86" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }} numberOfLines={1}>
            {a.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Calendar size={12} color="#9ca3af" />
            <Text style={{ fontSize: 12, color: "#6b7280" }}>
              {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} ·{" "}
              {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

function QuickIcon({ icon: Icon, label, onPress }: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flex: 1, alignItems: "center", gap: 6 }}>
      <View style={{
        width: 52, height: 52, borderRadius: 16,
        backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb",
        alignItems: "center", justifyContent: "center",
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
      }}>
        <Icon size={22} color="#1aaa86" />
      </View>
      <Text style={{ fontSize: 11, color: "#374151", textAlign: "center" }}>{label}</Text>
    </TouchableOpacity>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontSize: 12, color: "#6b7280" }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: "600", color: "#111827" }}>{value}</Text>
    </View>
  );
}

function ExploreItem({ label, icon: Icon, onPress }: {
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: "47%",
        flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: "#fff", borderRadius: 10, borderWidth: 1,
        borderColor: "#fff", padding: 10,
      }}
    >
      <Icon size={16} color="#1aaa86" />
      <Text style={{ fontSize: 13, color: "#374151" }}>{label}</Text>
    </TouchableOpacity>
  );
}
