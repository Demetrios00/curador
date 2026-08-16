import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { collection, doc, getDocs, orderBy, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Appointment, AppointmentPrefill } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Tabs } from "@/components/Tabs";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { Calendar, Check, MapPin, Plus, Stethoscope, X } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AgendamentosStackParamList } from "@/navigation/StacksNavigator";
import Toast from "react-native-toast-message";

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
  // Ideia 5 (claude/avaliacao-ajustes-2.0.md): id do agendamento com uma
  // chamada de Confirmar/Cancelar em andamento — evita duplo toque disparar
  // duas escritas concorrentes no mesmo documento.
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  /**
   * Ideia 5 (claude/avaliacao-ajustes-2.0.md): Confirmar/Cancelar são ações
   * determinísticas de botão (sem LLM envolvida) — mesmo padrão de escrita
   * direta no Firestore já usado em `NovoAgendamento.tsx` (`addDoc`) e
   * `Perfil.tsx` (`updateDoc`). Atualiza o estado local otimisticamente após
   * o `updateDoc` confirmar, em vez de refazer a consulta inteira.
   */
  const handleConfirm = async (a: Appointment) => {
    setUpdatingId(a.id);
    try {
      await updateDoc(doc(db, "appointments", a.id), { status: "confirmado" });
      setItems((prev) => prev.map((item) => (item.id === a.id ? { ...item, status: "confirmado" } : item)));
      Toast.show({ type: "success", text1: "Agendamento confirmado" });
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Erro ao confirmar", text2: err?.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancelPress = (a: Appointment) => {
    // Alert.alert de confirmação: evita cancelar um compromisso de saúde real
    // por um toque acidental (mesmo cuidado já adotado no projeto para ações
    // destrutivas — Seção 21/23).
    Alert.alert(
      "Cancelar agendamento",
      `Deseja realmente cancelar "${a.title}"?`,
      [
        { text: "Voltar", style: "cancel" },
        { text: "Cancelar agendamento", style: "destructive", onPress: () => handleCancelConfirmed(a) },
      ]
    );
  };

  const handleCancelConfirmed = async (a: Appointment) => {
    setUpdatingId(a.id);
    try {
      await updateDoc(doc(db, "appointments", a.id), { status: "cancelado" });
      setItems((prev) => prev.map((item) => (item.id === a.id ? { ...item, status: "cancelado" } : item)));
      Toast.show({ type: "success", text1: "Agendamento cancelado" });
      offerReschedule(a);
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Erro ao cancelar", text2: err?.message });
    } finally {
      setUpdatingId(null);
    }
  };

  /**
   * Ideia 5: após cancelar, oferece remarcar imediatamente. Ao aceitar,
   * navega para "Novo agendamento" com um `AppointmentPrefill` — mesmo padrão
   * já criado na Ideia 3 para `ReferralPrefill` — reaproveitando
   * tipo/hospital/especialidade/médico do agendamento cancelado e deixando
   * apenas data e horário para o paciente escolher de novo.
   *
   * `navigation` aqui é tipado contra `AgendamentosStackParamList` (só tem
   * "Agendamentos"/"NovoAgendamento"), mas esta tela é montada de fato dentro
   * de `HomeStack` em tempo de execução — o mesmo padrão de navegação
   * cross-stack já usado em `Encaminhamentos.tsx` (`navigation.navigate
   * ("Agendar", ...)`, aba de nível superior) é usado aqui, com um cast
   * pontual, em vez de forçar esse acoplamento na tipagem estrita do resto do
   * arquivo.
   */
  const offerReschedule = (a: Appointment) => {
    Alert.alert(
      "Remarcar agendamento?",
      "Você pode remarcar agora, reaproveitando os mesmos dados (menos data e horário), ou remarcar depois pela aba Agendar.",
      [
        { text: "Agora não", style: "cancel" },
        {
          text: "Remarcar agora",
          onPress: () => {
            const prefill: AppointmentPrefill = {
              type: a.type,
              hospitalId: a.hospitalId,
              specialtyId: a.specialtyId,
              doctorId: a.doctorId,
              examOrSurgeryName: a.type === "exame" || a.type === "cirurgia" ? a.title : undefined,
              sourceAppointmentId: a.id,
            };
            (navigation as any).navigate("Agendar", { prefill });
          },
        },
      ]
    );
  };

  const now = Date.now();

  /**
   * Ideia 2.0-#2 (claude/avaliacao-ajustes-2.0.md): a consulta busca tudo
   * ordenado do mais novo para o mais antigo (`orderBy("date", "desc")`) e
   * só depois filtra passado/futuro — sem reordenar cada subconjunto.
   * ANTES: "Próximos" herdava a ordem descendente da consulta inteira, então
   * o agendamento mais distante no futuro aparecia primeiro (errado — o
   * paciente quer ver o mais próximo primeiro). "Histórico" parecia certo
   * por acidente (mais recente primeiro), não por uma ordenação própria.
   * DEPOIS: cada lista é ordenada explicitamente, independente da ordem da
   * consulta original — "Próximos" ascendente (mais próximo primeiro),
   * "Histórico" descendente (mais recente primeiro).
   */
  const proximos = items
    .filter((a) => new Date(a.date).getTime() >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const historico = items
    .filter((a) => new Date(a.date).getTime() < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
                <AppointmentCard
                  key={a.id}
                  a={a}
                  // Ideia 5: Confirmar/Cancelar só fazem sentido para
                  // compromissos futuros — no "Histórico" (já passados) essas
                  // ações não são exibidas.
                  showActions={activeTab === "proximos"}
                  updating={updatingId === a.id}
                  onConfirm={() => handleConfirm(a)}
                  onCancel={() => handleCancelPress(a)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function AppointmentCard({
  a,
  showActions,
  updating,
  onConfirm,
  onCancel,
}: {
  a: Appointment;
  showActions: boolean;
  updating: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const d = new Date(a.date);
  // Ideia 5 (claude/avaliacao-ajustes-2.0.md): "Confirmar" só faz sentido
  // partindo de "agendado" (não há mais nada a confirmar em "confirmado").
  // "Cancelar" continua disponível em "agendado" e "confirmado". Em
  // "concluido"/"cancelado" (estados terminais) nenhum botão é exibido.
  const canConfirm = showActions && a.status === "agendado";
  const canCancel = showActions && (a.status === "agendado" || a.status === "confirmado");

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

      {(canConfirm || canCancel) && (
        <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
          {canConfirm && (
            <TouchableOpacity
              onPress={onConfirm}
              disabled={updating}
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                height: 38, borderRadius: 10, backgroundColor: updating ? "#9ca3af" : "#1aaa86",
              }}
              accessibilityLabel="Confirmar agendamento"
            >
              {updating ? <ActivityIndicator size="small" color="#fff" /> : <Check size={15} color="#fff" />}
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>Confirmar</Text>
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity
              onPress={onCancel}
              disabled={updating}
              style={{
                flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
                height: 38, borderRadius: 10, borderWidth: 1,
                borderColor: updating ? "#d1d5db" : "#ef4444",
              }}
              accessibilityLabel="Cancelar agendamento"
            >
              <X size={15} color={updating ? "#9ca3af" : "#ef4444"} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: updating ? "#9ca3af" : "#ef4444" }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Card>
  );
}
