import { useCallback, useState } from "react";
import { CommonActions, useFocusEffect } from "@react-navigation/native";
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
import { Appointment, MedicalResult, Prescription } from "@/types";
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
  Pill,
  Plus,
  Send,
  Sun,
  TrendingUp,
} from "lucide-react-native";
import { Card } from "@/components/Card";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "@/navigation/StacksNavigator";
import { fetchHealthScore, type HealthScoreResponse } from "@/services/healthScoreApi";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemePalette } from "@/theme/colors";

interface Stats {
  proximas: number;
  realizados: number;
  resultados: number;
  /**
   * Ideia 4a (claude/avaliacao-evolucao-pre-fase8.md): `consultas`, `exames`
   * e `prescricoes` alimentam o card "Suas Métricas" — que já dizia "Últimos
   * 30 dias" na tela, mas antes contava o histórico inteiro do paciente
   * (sem filtro de data). Agora refletem só a janela móvel dos últimos 30
   * dias. `proximas`/`realizados`/`resultados` (tiles do topo) permanecem
   * como estavam — não fazem parte do card "Suas Métricas" e não foram
   * mencionados no escopo desta ideia.
   */
  consultas: number;
  exames: number;
  prescricoes: number;
}

export default function Home() {
  const { patient, user } = useAuth();
  const { mode, colors, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [next, setNext] = useState<Appointment[]>([]);
  const [lastResult, setLastResult] = useState<MedicalResult | null>(null);
  // Ideia 2.0-#3 (claude/avaliacao-ajustes-2.0.md): prescrição mais recente
  // do paciente (sem filtro de 30 dias — diferente da contagem usada em
  // "Suas Métricas"), um dos critérios de prioridade de "Alertas Importantes".
  const [lastPrescription, setLastPrescription] = useState<Prescription | null>(null);
  // Ideia 4b (claude/ideia4b-score-saude-dia-proposta.md): o score não é
  // mais calculado aqui — vem pronto do backend
  // (`GET /api/patients/me/health-score`). `null` = ainda carregando ou
  // paciente inelegível (sem nenhum agendamento registrado).
  const [healthScore, setHealthScore] = useState<HealthScoreResponse | null>(null);
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
      // Correção 18/10: `appointments.date` é gravado em UTC real (`toISOString()`
      // em NovoAgendamento). O deslocamento manual de fuso usado antes fazia
      // agendamentos de até 3h atrás aparecerem como "próximos".
      const localIso = now.toISOString();

      // Ideia 4a: janela móvel dos últimos 30 dias, para o card "Suas
      // Métricas". Mesma conversão de fuso já usada acima em `localIso`
      // (mantém consistência com o restante deste arquivo — ver nota de
      // rastreabilidade em `claude/ideia4a-metricas-30-dias-status.md`).
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();

      const upcomingQ = query(
        collection(db, "appointments"),
        where("patientUid", "==", user.uid),
        where("date", ">=", localIso),
        orderBy("date", "asc"),
        limit(10)
      );
      const upcomingSnap = await getDocs(upcomingQ);
      const upcoming = upcomingSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Appointment[];
      // Cancelados não são "próximos agendamentos".
      const upcomingActive = upcoming.filter((a) => a.status !== "cancelado");
      setNext(upcomingActive.slice(0, 2));

      const allApptsSnap = await getDocs(
        query(collection(db, "appointments"), where("patientUid", "==", user.uid))
      );
      const allAppts = allApptsSnap.docs.map((d) => d.data() as Appointment);

      // Ideia 4a: agendamentos (consultas/exames) dos últimos 30 dias, para
      // o card "Suas Métricas" — consulta separada de `allApptsSnap` (usada
      // em `realizados`, que continua sendo histórico completo).
      // Correção 18/10: filtro da janela feito em memória sobre `allAppts`
      // (já carregado acima) — a consulta com intervalo exigia índice
      // composto no Firestore e falhava para usuários novos. Contam apenas
      // atendimentos com presença confirmada (status "concluido").
      const last30dAppts = allAppts.filter(
        (a: any) => a.date >= thirtyDaysAgoIso && a.date <= localIso && a.status === "concluido"
      );

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

      // Ideia 2.0-#3: prescrição mais recente (todo o histórico, não só os
      // últimos 30 dias — critério de prioridade de "Alertas Importantes",
      // diferente da contagem de "Suas Métricas" abaixo).
      const latestPrescriptionSnap = await getDocs(
        query(
          collection(db, "prescriptions"),
          where("patientUid", "==", user.uid),
          orderBy("date", "desc"),
          limit(1)
        )
      ).catch((error) => {
        console.log("Error fetching latest prescription snap", error);
        return { docs: [] } as any;
      });
      setLastPrescription(
        latestPrescriptionSnap.docs.length > 0
          ? ({ id: latestPrescriptionSnap.docs[0].id, ...latestPrescriptionSnap.docs[0].data() } as Prescription)
          : null
      );

      // Ideia 4a: prescrições dos últimos 30 dias (mesma janela dos agendamentos acima).
      // Correção 18/10: mesma estratégia — busca por paciente e filtra a
      // janela em memória, sem depender de índice composto.
      const allPrescSnap = await getDocs(
        query(collection(db, "prescriptions"), where("patientUid", "==", user.uid))
      ).catch((error) => {
        console.log("Error fetching prescriptions", error);
        return { docs: [] } as any;
      });
      const last30dPrescCount = allPrescSnap.docs
        .map((d: any) => d.data())
        .filter((p: any) => typeof p.date === "string" && p.date >= thirtyDaysAgoIso && p.date <= localIso).length;

      let realizados = allAppts.filter((a) => a.status === "concluido").length;

      // Ideia 4b: score buscado do backend, não mais calculado aqui.
      // Falha ao buscar não deve travar o resto da Home — o card
      // simplesmente some (mesmo tratamento de "sem dado" que os demais
      // blocos desta função já usam, ex.: `resultsSnap`/`latestResultSnap`).
      try {
        const idToken = await user.getIdToken();
        const score = await fetchHealthScore(idToken);
        setHealthScore(score);
      } catch (error) {
        console.log("Error fetching health score", error);
        setHealthScore(null);
      }

      setStats({
        proximas: upcoming.length,
        realizados: realizados,
        resultados: resultsSnap.size ?? 0,
        consultas: last30dAppts.filter((a: any) => a.type === "consulta").length,
        exames: last30dAppts.filter((a: any) => a.type === "exame").length,
        prescricoes: last30dPrescCount,
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

  /**
   * ANTES (correção pós-teste real de 16/08/2026, nunca confirmada em
   * dispositivo): a tentativa anterior navegava primeiro para a tela raiz da
   * stack de destino e só depois para a tela pedida, em duas chamadas de
   * `navigate` no mesmo tick, apostando que a primeira "fecharia" o que
   * estivesse em cima da raiz antes da segunda empilhar a tela pedida.
   *
   * Teste real (03/09/2026) reproduziu exatamente o bug original: tocar
   * "Prescrições" e depois "Encaminhamentos" (Acesso Rápido da Home) fez
   * "voltar" em Encaminhamentos cair em Prescrições, não na Home. Causa:
   * para um navegador aninhado que não está em foco, as duas chamadas de
   * `navigate` são resolvidas contra o MESMO estado-base (o estado anterior
   * à primeira) — a segunda não "enxerga" o efeito da primeira antes de
   * ambas serem processadas, então só a última prevalece e o que já estava
   * empilhado (Prescrições) nunca é removido.
   *
   * DEPOIS: em vez de compor duas ações de `navigate`, despachamos uma
   * ÚNICA ação `CommonActions.reset`, direcionada (`target`) à stack
   * aninhada da aba de destino pela própria key dela — obtida via
   * `getParent().getState()` a partir do Tab Navigator. Isso substitui de
   * uma vez o conteúdo daquela stack por só a tela pedida, sem nenhuma tela
   * "raiz" por baixo — o mesmo estado que aquela aba teria numa primeira
   * visita. Com uma stack de 1 tela só, "voltar" não tem mais nada para
   * desempilhar ali dentro e sobe para o Tab Navigator, que (sem
   * `backBehavior` customizado em `TabNavigator.tsx` — o padrão do
   * React Navigation é `"history"`) volta para a ÚLTIMA aba visitada: a
   * Home, no fluxo do Acesso Rápido/Explorar Mais/Alertas Importantes.
   *
   * Quando a aba de destino ainda não foi visitada nesta sessão (sua stack
   * aninhada ainda não existe), um `navigate` simples já nasce com só a
   * tela pedida — não há nada para resetar.
   *
   * IMPACTO NO TCC: nenhum — comportamento de navegação interno ao app,
   * não descrito na arquitetura do artigo.
   *
   * CORREÇÃO (03/09/2026, mesmo dia): a versão acima, quando chamada SEM
   * `screen` (ex.: `goToTab("Resultados")`, do atalho "Resultados" do
   * Acesso Rápido), só fazia um `navigate(tabName)` simples — sem resetar
   * nada. Bug real encontrado no teste: depois de visitar "Prescrições"
   * (que reseta a stack da aba "Resultados" para conter só ela), tocar no
   * atalho "Resultados" passou a abrir "Prescrições" — porque essa é,
   * agora, a ÚNICA tela daquela stack, e um `navigate(tabName)` sem
   * `screen` só foca a aba, mostrando o que já estiver no topo dela.
   * `TAB_ROOT_SCREEN` resolve a tela-raiz de cada aba com stack aninhada,
   * para que "sem `screen`" também passe pelo mesmo reset de uma tela só —
   * agora sempre a raiz certa, nunca uma tela deixada por uma visita
   * anterior.
   */
  const TAB_ROOT_SCREEN: Record<string, string> = {
    Resultados: "Resultados",
    Menu: "Perfil",
  };

  const goToTab = (tabName: string, screen?: string) => {
    const targetScreen = screen ?? TAB_ROOT_SCREEN[tabName];

    if (!targetScreen) {
      // Aba sem stack aninhada própria (ex.: "Agendar") — nada a resetar.
      (navigation as any).navigate(tabName);
      return;
    }

    const tabNavigation = navigation.getParent() ?? navigation;
    const tabState = (tabNavigation as any).getState?.();
    const tabRoute = tabState?.routes?.find((r: { name: string }) => r.name === tabName);

    if (tabRoute?.state?.key) {
      (tabNavigation as any).dispatch({
        ...CommonActions.reset({ index: 0, routes: [{ name: targetScreen }] }),
        target: tabRoute.state.key,
      });
    } else {
      (tabNavigation as any).navigate(tabName, { screen: targetScreen });
    }
  };

  /**
   * Ideia 2.0-#3 (claude/avaliacao-ajustes-2.0.md), versão V1 aprovada:
   * "Alertas Importantes" passa a mostrar o item mais relevante entre um
   * pequeno conjunto de critérios estáticos, em vez de sempre o último
   * resultado disponível (que podia ser antigo mesmo havendo algo mais
   * urgente). Prioridade: 1) encaminhamento pendente mais antigo ou
   * agendamento perdido (já vêm priorizados nesta ordem em
   * `healthScore.improvements`, reaproveitado da Ideia 4b — nenhuma
   * chamada nova ao backend); 2) prescrição mais recente (informativo);
   * 3) resultado disponível mais recente (comportamento anterior, agora
   * como último critério, não único). Não tenta detectar "mudança recente"
   * de status de verdade — isso exigiria um campo novo no schema
   * (`statusChangedAt`), decisão explicitamente adiada (V2, não aprovada
   * agora).
   */
  const topImprovement = healthScore?.improvements?.[0] ?? null;
  const topAlert = topImprovement
    ? {
        icon: topImprovement.type === "referral_pending" ? Send : Calendar,
        title:
          topImprovement.type === "referral_pending"
            ? "Encaminhamento pendente"
            : topImprovement.type === "attendance_pending"
            ? "Confirme sua presença"
            : "Agendamento perdido",
        subtitle: topImprovement.message,
        onPress: () =>
          topImprovement.type === "referral_pending"
            ? goToTab("Resultados", "Encaminhamentos")
            : navigation.navigate("Agendamentos"),
      }
    : lastPrescription
    ? {
        icon: Pill,
        title: lastPrescription.medications?.[0]?.name ?? "Nova prescrição",
        subtitle: `${lastPrescription.doctorName} · ${new Date(lastPrescription.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`,
        onPress: () => goToTab("Resultados", "Prescricoes"),
      }
    : lastResult
    ? {
        icon: FileText,
        title: lastResult.title,
        subtitle: `${lastResult.hospitalName} · ${new Date(lastResult.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`,
        onPress: () => goToTab("Resultados"),
      }
    : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
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
            {/* Ideia 2: ícone que já existia aqui era decorativo (sem
                `onPress`) — passa a alternar o tema e a espelhar o modo
                atual (lua no claro, sol no escuro). */}
            <TouchableOpacity style={{ padding: 8 }} accessibilityLabel="Alternar tema" onPress={toggleTheme}>
              {mode === "dark" ? (
                <Sun size={20} color="rgba(255,255,255,0.9)" />
              ) : (
                <Moon size={20} color="rgba(255,255,255,0.9)" />
              )}
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

        {/* Ideia 2.0-#4 (claude/avaliacao-ajustes-2.0.md): ANTES, esta linha
            mostrava 3 números (Próximas/Realizados/Resultados) — já
            calculados a partir de dado real do Firestore, não estático,
            mas repetitivos com os tiles do topo de `Agendamentos.tsx`/o
            card "Alertas". DEPOIS, dá lugar ao "Acesso Rápido" (antes mais
            abaixo, fundo branco) — variante `QuickIconHero`, estilizada
            para contraste sobre o degradê.

            Ajuste solicitado junto do Item 1 (Enter): "Teleconsulta" e
            "Perfil" saem deste atalho de topo (Teleconsulta não corresponde
            a nenhuma tela existente hoje — reaproveitava a rota "Agendar";
            Perfil já está a um toque no menu lateral). No lugar entram
            "Prescrições" e "Encaminhamentos" — telas já existentes,
            reaproveitadas aqui só como atalho mais rápido (continuam
            também disponíveis em "Explorar Mais", mais abaixo). */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
          <QuickIconHero icon={Calendar} label="Agendar" onPress={() => goToTab("Agendar")} />
          <QuickIconHero icon={Pill} label="Prescrições" onPress={() => goToTab("Resultados", "Prescricoes")} />
          <QuickIconHero icon={FileText} label="Resultados" onPress={() => goToTab("Resultados")} />
          <QuickIconHero icon={Send} label="Encaminhamentos" onPress={() => goToTab("Resultados", "Encaminhamentos")} />
        </View>
      </LinearGradient>

      {/* Featured card */}
      <View style={{ marginTop: -52, paddingHorizontal: 20 }}>
        {loading ? (
          <View style={{ height: 140, borderRadius: 16, backgroundColor: colors.border }} />
        ) : featured ? (
          <FeaturedAppointment a={featured} onPress={() => navigation.navigate("Agendamentos")} colors={colors} />
        ) : (
          <View style={{ backgroundColor: colors.surface, borderRadius: 16 }}>
            <Card style={{ borderRadius: 16, borderStyle: "dashed", padding: 24, alignItems: "center" }}>
              <Calendar size={32} color={colors.textSubtle} />
              <Text style={{ marginTop: 8, fontSize: 14, color: colors.textMuted, textAlign: "center" }}>
                Você não tem agendamentos.
              </Text>
              <TouchableOpacity onPress={() => goToTab("Agendar")} style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.primary }}>Agendar agora</Text>
              </TouchableOpacity>
            </Card>
          </View>
        )}
      </View>

      {/* Alertas — Ideia 2.0-#3: mostra `topAlert` (o item mais relevante
          entre encaminhamento pendente, agendamento perdido, prescrição
          recente ou resultado disponível — ver cálculo de `topAlert` acima),
          não mais sempre o último resultado disponível. */}
      {topAlert && (
        <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AlertCircle size={16} color="#f59e0b" />
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Alertas Importantes</Text>
          </View>
          <TouchableOpacity onPress={topAlert.onPress} activeOpacity={0.8}>
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
                <topAlert.icon size={16} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }} numberOfLines={1}>
                  {topAlert.title}
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={1}>
                  {topAlert.subtitle}
                </Text>
              </View>
              <ChevronRight size={16} color={colors.textSubtle} />
            </Card>
          </TouchableOpacity>
        </View>
      )}

      {/* Métricas
          Ideia 2 — decisão de design registrada em
          `claude/ideia2-tema-dark-light-status.md` (seção 1.4):
          ANTES, "Suas Métricas" tinha fundo sólido pastel (#d1fae5) e ícone
          verde-esmeralda fixo (#059669) — nenhuma dessas cores fazia parte
          da paleta de marca do app, e um fundo sólido não se adapta ao tema
          escuro. DEPOIS, usa o mesmo padrão de tinta translúcida sobre
          `colors.primary` que o card irmão "Saúde em Dia" já usava —
          ícone/texto passam a vir da paleta. Sem impacto no TCC (mudança
          puramente visual). */}
      <View style={{ marginTop: 24, paddingHorizontal: 20, flexDirection: "row", gap: 12 }}>
        <Card style={{ elevation: 0, flex: 1, borderRadius: 16, borderWidth: 0, backgroundColor: "rgba(26,170,134,0.08)", padding: 16 }}>
          <Activity size={20} color={colors.primary} />
          <Text style={{ marginTop: 12, fontSize: 14, fontWeight: "600", color: colors.text }}>
            Suas Métricas
          </Text>
          <Text style={{ fontSize: 11, color: colors.textMuted }}>Últimos 30 dias</Text>
          <View style={{ marginTop: 12, gap: 4 }}>
            <MetricRow label="Consultas" value={stats.consultas} colors={colors} />
            <MetricRow label="Exames" value={stats.exames} colors={colors} />
            <MetricRow label="Prescrições" value={stats.prescricoes} colors={colors} />
          </View>
        </Card>
        {healthScore?.eligible && healthScore.score !== null ? (
          <Card style={{ elevation: 0, flex: 1, borderRadius: 16, borderWidth: 0, backgroundColor: "rgba(26,170,134,0.05)", padding: 16 }}>
            <TrendingUp size={20} color="#1aaa86" />
            <Text style={{ marginTop: 12, fontSize: 14, fontWeight: "600", color: colors.text }}>
              Saúde em Dia
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted }}>Score de bem-estar</Text>
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 12, color: colors.textMuted }}>Progresso</Text>
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#1aaa86" }}>{healthScore.score}%</Text>
              </View>
              <View style={{
                marginTop: 6, height: 6, borderRadius: 3,
                backgroundColor: "rgba(26,170,134,0.15)", overflow: "hidden",
              }}>
                <View style={{ width: `${healthScore.score}%`, height: "100%", borderRadius: 3, backgroundColor: "#1aaa86" }} />
              </View>
            </View>
            {/* Ideia 4b: até 3 alertas acionáveis, priorizados pelo backend (`healthScore.service.ts`). */}
            {healthScore.improvements.length > 0 && (
              <View style={{ marginTop: 12, gap: 6 }}>
                {healthScore.improvements.map((imp, i) => (
                  <Text key={i} style={{ fontSize: 11, color: colors.textMuted }} numberOfLines={2}>
                    • {imp.message}
                  </Text>
                ))}
              </View>
            )}
          </Card>
        ) : (
          <Card style={{ elevation: 0, flex: 1, borderRadius: 16, borderWidth: 0, backgroundColor: "rgba(26,170,134,0.05)", padding: 16, justifyContent: "center" }}>
            <TrendingUp size={20} color={colors.textSubtle} />
            <Text style={{ marginTop: 12, fontSize: 14, fontWeight: "600", color: colors.text }}>
              Saúde em Dia
            </Text>
            <Text style={{ marginTop: 4, fontSize: 11, color: colors.textMuted }}>
              Disponível após seu primeiro agendamento.
            </Text>
          </Card>
        )}
      </View>

      {/* Próximos Agendamentos */}
      <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
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
              <View key={i} style={{ height: 100, borderRadius: 16, backgroundColor: colors.border }} />
            ))}
          </View>
        ) : next.length === 0 ? (
          <Card style={{ borderRadius: 16, borderStyle: "dashed", padding: 24, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: colors.textMuted }}>Nenhum agendamento futuro</Text>
          </Card>
        ) : (
          <View style={{ gap: 12 }}>
            {next.map((a) => <SmallAppointmentCard key={a.id} a={a} colors={colors} />)}
          </View>
        )}
      </View>

      {/* Explorar Mais */}
      <View style={{ marginTop: 24, paddingHorizontal: 20, marginBottom: 32 }}>
        <Card style={{ elevation: 0, borderRadius: 16, backgroundColor: "rgba(26,170,134,0.06)", padding: 16, shadowOpacity: 0, borderColor: "rgba(26,170,134,0.15)" }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 12 }}>
            Explorar Mais
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <ExploreItem label="Prescrições" icon={FileText} onPress={() => goToTab("Resultados", "Prescricoes")} colors={colors} />
            <ExploreItem label="Encaminhamentos" icon={FileText} onPress={() => goToTab("Resultados", "Encaminhamentos")} colors={colors} />
            <ExploreItem label="Unidades" icon={MapPin} onPress={() => goToTab("Menu", "UnidadesProximas")} colors={colors} />
            <ExploreItem label="Perfil" icon={MessageSquare} onPress={() => goToTab("Menu", "Perfil")} colors={colors} />
          </View>
        </Card>
      </View>
    </ScrollView>
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

function FeaturedAppointment({ a, onPress, colors }: { a: Appointment; onPress: () => void; colors: ThemePalette }) {
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
          <Text style={{ fontSize: 12, color: colors.textMuted }}>{dateLabel}</Text>
        </View>
        <ChevronRight size={16} color={colors.textSubtle} />
      </View>
      <Text style={{ marginTop: 8, fontSize: 16, fontWeight: "700", color: colors.text }}>{a.title}</Text>
      <Text style={{ marginTop: 4, fontSize: 14, color: colors.textMuted }}>
        {(a as any).professionalName ?? "Profissional"} ·{" "}
        {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
        <MapPin size={12} color={colors.textMuted} />
        <Text style={{ fontSize: 12, color: colors.textMuted }}>{a.hospitalName}</Text>
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

function SmallAppointmentCard({ a, colors }: { a: Appointment; colors: ThemePalette }) {
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
          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }} numberOfLines={1}>
            {a.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Calendar size={12} color={colors.textSubtle} />
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} ·{" "}
              {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

/**
 * Ideia 2.0-#4 (claude/avaliacao-ajustes-2.0.md): variante de "Acesso
 * Rápido" para uso DENTRO do hero em degradê (substituiu `QuickIcon`, que
 * era pensado para fundo claro — fundo branco sólido com sombra ficaria
 * com contraste ruim sobre o degradê verde/azul). Mesmo tratamento visual
 * translúcido que os tiles de número já usavam (`rgba(255,255,255,0.15)`),
 * ícone e texto em branco em vez de escuro.
 */
function QuickIconHero({ icon: Icon, label, onPress }: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flex: 1, alignItems: "center", gap: 6 }}>
      <View style={{
        width: 52, height: 52, borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.16)",
        alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={22} color="#fff" />
      </View>
      <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.95)", textAlign: "center" }}>{label}</Text>
    </TouchableOpacity>
  );
}

function MetricRow({ label, value, colors }: { label: string; value: number; colors: ThemePalette }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontSize: 12, color: colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.text }}>{value}</Text>
    </View>
  );
}

function ExploreItem({ label, icon: Icon, onPress, colors }: {
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
  colors: ThemePalette;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: "47%",
        flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1,
        borderColor: colors.surface, padding: 10,
      }}
    >
      <Icon size={16} color="#1aaa86" />
      <Text style={{ fontSize: 13, color: colors.text }}>{label}</Text>
    </TouchableOpacity>
  );
}
