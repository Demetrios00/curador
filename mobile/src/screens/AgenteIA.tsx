import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bot, Send, User } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import {
  routeOrchestratorMessage,
  confirmAppointmentDraft,
  type AppointmentDraft,
} from "@/services/orchestratorApi";
import { useTheme } from "@/contexts/ThemeContext";

const PRIMARY = "#1aaa86";

interface MessageMeta {
  intent: string;
  confidence: number;
  agent: string | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: MessageMeta;
  /**
   * Ideia 5b: presente somente na mensagem do assistente que apresentou um
   * rascunho de agendamento ainda não confirmado nem cancelado. Controla a
   * exibição dos botões "Confirmar agendamento" / "Cancelar" logo abaixo do
   * balão. Some (via `resolveDraftMessage`) assim que o paciente decide —
   * os botões nunca ficam visíveis em mais de uma mensagem por vez, porque
   * cada rascunho é resolvido antes de o próximo poder ser criado (o texto
   * de confirmação/cancelamento vira uma nova mensagem, não reabre esta).
   */
  pendingDraft?: AppointmentDraft;
}

/**
 * Mensagem padrão quando o Orquestrador não reconhece nenhum dos 4
 * domínios atendidos (intent UNKNOWN — Seção 9 do projeto). O CuraDor
 * deliberadamente não tenta responder qualquer pergunta de saúde de
 * forma genérica: os agentes cobrem organização/consulta/orientação
 * operacional, nunca diagnóstico (Seção 23 do projeto).
 */
const FALLBACK_UNKNOWN_MESSAGE =
  "Não consegui identificar sua solicitação dentro dos temas que consigo ajudar hoje: agendamentos, instruções de exame/cirurgia, resultados de exames ou unidades próximas. Pode reformular a pergunta?";

/**
 * ANTES (auditoria Fase 0 — achado crítico de segurança): esta tela
 * chamava a API da OpenRouter diretamente do app mobile, com a chave
 * hardcoded em `config/openrouter.ts` — exposta no bundle do app.
 *
 * AGORA: delega ao Agente Orquestrador do backend
 * (`POST /api/orchestrator/route`), autenticado com o ID token do
 * Firebase do usuário logado (`useAuth().user`). O app não conhece mais
 * URL, modelo ou prompt de sistema da LLM, nem qual agente especializado
 * respondeu — só envia a mensagem (e a localização atual, via
 * `useGeolocation`, para o caso do Agente de Unidades) e exibe a
 * resposta consolidada que o orquestrador devolve.
 *
 * `meta` (intent/confiança/agente) é exibido como legenda discreta abaixo
 * da resposta do assistente — não existia na versão anterior. Serve como
 * evidência direta, na própria tela do app, de qual agente respondeu a
 * cada mensagem (útil para capturas de tela do TCC). Pode ser removido
 * sem nenhum impacto funcional caso não seja desejado na versão final.
 *
 * Ideia 5b (02/09/2026): quando `response.result?.requiresConfirmation` é
 * `true`, a mensagem do assistente passa a carregar `pendingDraft` e exibe
 * dois botões — "Confirmar agendamento" e "Cancelar". O app NUNCA edita o
 * `draft` recebido: só o guarda na mensagem e, se confirmado, o reenvia
 * exatamente como veio via `confirmAppointmentDraft`. Cancelar é 100% local
 * (não chama o backend) — nenhum estado foi gravado até a confirmação, então
 * não há nada para desfazer no servidor.
 *
 * Ideia 2 — extensão de escopo (03/09/2026): esta tela ficava totalmente
 * fora do escopo reduzido original — nenhuma cor era themeada, nem o fundo
 * nem os balões do chat. Retemada por completo nesta rodada, junto com
 * Novo Agendamento e Unidades Próximas. O cabeçalho (verde, hero) permanece
 * com cor de marca fixa nos dois temas — mesma convenção já usada em
 * `PageHeader` (variant="hero").
 */
export default function AgenteIA() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { coords } = useGeolocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Olá! Sou o assistente de saúde virtual do CuraDor. Como posso te ajudar hoje?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  // Correção 18/10 (teste em dispositivo físico): com edge-to-edge ativo no
  // Android (app.json), o `KeyboardAvoidingView` com behavior "height" não
  // reage ao teclado e a caixa de texto ficava escondida atrás dele. No
  // Android, a altura do teclado é lida diretamente dos eventos do sistema e
  // aplicada como espaço inferior (descontando a barra de abas, que fica
  // por baixo do teclado).
  const tabBarHeight = useBottomTabBarHeight();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const androidKeyboardPadding = Math.max(0, keyboardHeight - tabBarHeight);
  // Ideia 2.0-#1 (claude/avaliacao-ajustes-2.0.md) — correção pós-teste real:
  // com `submitBehavior="submit"`, o teclado Android de alguns dispositivos
  // dispara `onSubmitEditing` DUAS vezes para um único Enter (falha conhecida
  // do RN em campos multiline no Android, independente da nossa lógica).
  // Confirmado no teste real: a mensagem foi enviada duplicada. O guard
  // `if (!text || loading) return` sozinho não bastava, porque as duas
  // chamadas acontecem síncronas, no mesmo tick — antes de `setLoading(true)`
  // (state do React) realmente propagar, então a segunda chamada ainda via
  // `loading === false`. Um `ref` muda de valor imediatamente, de forma
  // síncrona, então bloqueia a segunda chamada mesmo dentro do mesmo tick.
  const sendingRef = useRef(false);
  // Ideia 5b: mesma proteção contra duplo toque, aplicada aos botões
  // "Confirmar agendamento" / "Cancelar" (evita disparar `confirmAppointmentDraft`
  // duas vezes com um toque duplo rápido, o que tentaria gravar o mesmo
  // agendamento duas vezes).
  const confirmingRef = useRef(false);

  /** Remove `pendingDraft` da mensagem indicada, escondendo os botões — usado tanto ao confirmar quanto ao cancelar. */
  function resolveDraftMessage(messageId: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, pendingDraft: undefined } : m))
    );
  }

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || loading || sendingRef.current) return;
    sendingRef.current = true;

    if (!user) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Sua sessão expirou. Faça login novamente para continuar.",
        },
      ]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const idToken = await user.getIdToken();
      const response = await routeOrchestratorMessage(idToken, text, coords);
      const replyText = response.result?.message ?? FALLBACK_UNKNOWN_MESSAGE;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: replyText,
          meta: {
            intent: response.intent,
            confidence: response.confidence,
            agent: response.agent,
          },
          pendingDraft:
            response.result?.requiresConfirmation && response.result.draft
              ? response.result.draft
              : undefined,
        },
      ]);
    } catch (e: any) {
      // Em desenvolvimento, mostramos o erro real (em vez de uma mensagem
      // genérica) para facilitar o diagnóstico durante os testes do TCC —
      // útil para diferenciar "backend fora do ar", "token inválido",
      // "timeout" etc. sem precisar cruzar com o terminal do backend.
      const detail = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Desculpe, ocorreu um erro ao processar sua mensagem.\n\nDetalhe técnico: ${detail}`,
        },
      ]);
    } finally {
      setLoading(false);
      sendingRef.current = false;
    }
  }

  /**
   * Ideia 5b: efetiva a criação do agendamento cujo rascunho foi mostrado
   * na mensagem `messageId`. Reenvia `draft` sem qualquer alteração — quem
   * resolve nomes/IDs e checa conflito de horário é sempre o backend
   * (`agents/appointments/scheduleAppointment.ts` + ferramenta MCP
   * `create_appointment`), nunca o app.
   */
  async function handleConfirmDraft(messageId: string, draft: AppointmentDraft) {
    if (loading || confirmingRef.current) return;
    confirmingRef.current = true;
    resolveDraftMessage(messageId);
    setLoading(true);

    if (!user) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Sua sessão expirou. Faça login novamente para continuar.",
        },
      ]);
      setLoading(false);
      confirmingRef.current = false;
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const response = await confirmAppointmentDraft(idToken, draft);
      const replyText = response.result?.message ?? FALLBACK_UNKNOWN_MESSAGE;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: replyText,
          meta: {
            intent: response.intent,
            confidence: response.confidence,
            agent: response.agent,
          },
        },
      ]);
    } catch (e: any) {
      const detail = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Desculpe, não consegui confirmar o agendamento.\n\nDetalhe técnico: ${detail}`,
        },
      ]);
    } finally {
      setLoading(false);
      confirmingRef.current = false;
    }
  }

  /**
   * Cancelar é puramente local: como nada foi gravado no backend antes da
   * confirmação (Ideia 5b — sem estado de conversa no servidor), não há
   * chamada de rede envolvida em desistir de um rascunho.
   */
  function handleCancelDraft(messageId: string) {
    resolveDraftMessage(messageId);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "assistant",
        content: "Sem problemas, cancelei esse agendamento. Se quiser, é só pedir de novo.",
      },
    ]);
  }

  function renderItem({ item }: { item: Message }) {
    const isUser = item.role === "user";
    return (
      <View
        style={{
          marginHorizontal: 16,
          marginVertical: 6,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: isUser ? "flex-end" : "flex-start",
          }}
        >
          {!isUser && (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: PRIMARY,
                alignItems: "center",
                justifyContent: "center",
                marginRight: 8,
              }}
            >
              <Bot size={18} color="#fff" />
            </View>
          )}

          <View
            style={{
              maxWidth: "75%",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 18,
              borderBottomLeftRadius: isUser ? 18 : 4,
              borderBottomRightRadius: isUser ? 4 : 18,
              backgroundColor: isUser ? PRIMARY : colors.surfaceAlt,
            }}
          >
            <Text style={{ color: isUser ? "#fff" : colors.text, fontSize: 15, lineHeight: 22 }}>
              {item.content}
            </Text>

            {!isUser && item.meta && (
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                {item.meta.agent ? `agente: ${item.meta.agent}` : "intenção: desconhecida"} · confiança{" "}
                {(item.meta.confidence * 100).toFixed(0)}%
              </Text>
            )}
          </View>

          {isUser && (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.surfaceAlt,
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 8,
              }}
            >
              <User size={18} color={colors.textMuted} />
            </View>
          )}
        </View>

        {!isUser && item.pendingDraft && (
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              marginTop: 8,
              marginLeft: 40,
            }}
          >
            <TouchableOpacity
              onPress={() => handleConfirmDraft(item.id, item.pendingDraft!)}
              disabled={loading}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 20,
                backgroundColor: loading ? "#a7d9cb" : PRIMARY,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
                Confirmar agendamento
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleCancelDraft(item.id)}
              disabled={loading}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.borderInput,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header — cor de marca fixa nos dois temas (mesma convenção de PageHeader variant="hero") */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingBottom: 16,
          paddingHorizontal: 20,
          backgroundColor: PRIMARY,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bot size={22} color="#fff" />
          </View>
          <View>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
              Assistente CuraDor
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>
              Agente de saúde virtual
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Typing indicator */}
      {loading && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 24,
            paddingVertical: 8,
          }}
        >
          <ActivityIndicator size="small" color={PRIMARY} />
          <Text style={{ marginLeft: 8, color: colors.textMuted, fontSize: 13 }}>
            Digitando...
          </Text>
        </View>
      )}

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? tabBarHeight : 0}
        style={Platform.OS === "android" ? { paddingBottom: androidKeyboardPadding } : undefined}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            paddingHorizontal: 16,
            paddingTop: 10,
            // A barra de abas já reserva o inset inferior do aparelho.
            paddingBottom: 10,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            gap: 10,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              minHeight: 44,
              maxHeight: 120,
              backgroundColor: colors.surfaceAlt,
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 15,
              color: colors.text,
            }}
            placeholder="Escreva sua mensagem..."
            placeholderTextColor={colors.placeholder}
            value={input}
            onChangeText={setInput}
            multiline
            // Ideia 2.0-#1 (claude/avaliacao-ajustes-2.0.md): a primeira
            // tentativa interceptava a quebra de linha no `onChangeText`
            // (checando se o texto terminava em "\n"), mas isso se mostrou
            // pouco confiável no teste real em dispositivo Android — o
            // teclado inseriu a quebra sem o `onChangeText` reportar a
            // string terminando em "\n" de forma consistente (varia por
            // teclado/IME). `submitBehavior="submit"` é a solução nativa e
            // documentada do React Native (RN 0.74+, substituindo o antigo
            // `blurOnSubmit`) para isso: instrui o próprio campo a disparar
            // `onSubmitEditing` no Enter em vez de inserir a quebra,
            // mesmo sendo `multiline` — não depende de adivinhar o
            // conteúdo reportado pelo teclado.
            submitBehavior="submit"
            onSubmitEditing={() => handleSend()}
            editable={!loading}
          />
          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: input.trim() && !loading ? PRIMARY : colors.borderInput,
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityLabel="Enviar mensagem"
          >
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
