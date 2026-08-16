import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bot, Send, User } from "lucide-react-native";
import { sendChatMessage } from "@/services/api";

const PRIMARY = "#1aaa86";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/**
 * Antes: chamava a API da OpenRouter diretamente do app mobile, com a chave
 * hardcoded em `config/openrouter.ts` (achado crítico da auditoria Fase 0).
 *
 * Agora: delega ao backend via `sendChatMessage` (`src/services/api.ts`).
 * O app não conhece mais URL, modelo, prompt de sistema ou chave da LLM —
 * apenas envia o histórico de mensagens e recebe a resposta pronta.
 */
async function fetchAIResponse(messages: { role: string; content: string }[]): Promise<string> {
  const history = messages.map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
    content: m.content,
  }));
  return sendChatMessage(history);
}

export default function AgenteIA() {
  const insets = useSafeAreaInsets();
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

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const history = nextMessages.map((m) => ({ role: m.role, content: m.content }));
      const reply = await fetchAIResponse(history);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: reply },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Desculpe, ocorreu um erro ao processar sua mensagem. Verifique a conexão e tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function renderItem({ item }: { item: Message }) {
    const isUser = item.role === "user";
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: isUser ? "flex-end" : "flex-start",
          marginHorizontal: 16,
          marginVertical: 6,
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
            backgroundColor: isUser ? PRIMARY : "#f3f4f6",
          }}
        >
          <Text style={{ color: isUser ? "#fff" : "#111827", fontSize: 15, lineHeight: 22 }}>
            {item.content}
          </Text>
        </View>

        {isUser && (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: "#e5e7eb",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 8,
            }}
          >
            <User size={18} color="#6b7280" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header */}
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
          <Text style={{ marginLeft: 8, color: "#6b7280", fontSize: 13 }}>
            Digitando...
          </Text>
        </View>
      )}

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: insets.bottom + 10,
            borderTopWidth: 1,
            borderTopColor: "#e5e7eb",
            backgroundColor: "#fff",
            gap: 10,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              minHeight: 44,
              maxHeight: 120,
              backgroundColor: "#f3f4f6",
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 15,
              color: "#111827",
            }}
            placeholder="Escreva sua mensagem..."
            placeholderTextColor="#9ca3af"
            value={input}
            onChangeText={setInput}
            multiline
            onSubmitEditing={handleSend}
            editable={!loading}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || loading}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: input.trim() && !loading ? PRIMARY : "#d1d5db",
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
