import { NavigationContainer } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { StatusBar } from "expo-status-bar";
import { ScrollView, View, Text } from "react-native";
import { AuthProvider } from "@/contexts/AuthContext";
import { RootNavigator } from "@/navigation/RootNavigator";

// Phase 4 component imports — remove after visual inspection
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Tabs } from "@/components/Tabs";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";

const queryClient = new QueryClient();

// Set to true to preview Phase 4 components, false for normal app flow
const PREVIEW_COMPONENTS = false;

function ComponentPreview() {
  const [activeTab, setActiveTab] = React.useState("proximos");
  const [inputValue, setInputValue] = React.useState("");

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f9fafb" }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 16 }}>Phase 4 — Component Preview</Text>

      <Text style={{ fontSize: 14, fontWeight: "600", color: "#6b7280", marginBottom: 8 }}>BUTTONS</Text>
      <View style={{ gap: 8, marginBottom: 20 }}>
        <Button onPress={() => {}}>Default Button</Button>
        <Button variant="outline" onPress={() => {}}>Outline Button</Button>
        <Button variant="ghost" onPress={() => {}}>Ghost Button</Button>
        <Button variant="destructive" onPress={() => {}}>Destructive</Button>
        <Button variant="secondary" size="sm" onPress={() => {}}>Secondary SM</Button>
        <Button loading onPress={() => {}}>Loading...</Button>
      </View>

      <Text style={{ fontSize: 14, fontWeight: "600", color: "#6b7280", marginBottom: 8 }}>INPUT</Text>
      <View style={{ marginBottom: 20 }}>
        <Input label="Nome completo" placeholder="Digite seu nome" value={inputValue} onChangeText={setInputValue} />
        <Input label="Email" placeholder="erro@exemplo.com" error="Endereço de e-mail inválido" />
      </View>

      <Text style={{ fontSize: 14, fontWeight: "600", color: "#6b7280", marginBottom: 8 }}>BADGES</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <Badge>Padrão</Badge>
        <Badge variant="secondary">Secundário</Badge>
        <Badge variant="destructive">Erro</Badge>
        <Badge variant="outline">Contorno</Badge>
        <Badge variant="success">Sucesso</Badge>
        <Badge variant="warning">Aviso</Badge>
      </View>

      <Text style={{ fontSize: 14, fontWeight: "600", color: "#6b7280", marginBottom: 8 }}>TABS</Text>
      <View style={{ marginBottom: 20 }}>
        <Tabs
          tabs={[{ key: "proximos", label: "Próximos" }, { key: "historico", label: "Histórico" }]}
          activeKey={activeTab}
          onChange={setActiveTab}
        />
      </View>

      <Text style={{ fontSize: 14, fontWeight: "600", color: "#6b7280", marginBottom: 8 }}>CARD</Text>
      <Card style={{ marginBottom: 20 }}>
        <CardHeader>
          <CardTitle>Consulta Cardiologia</CardTitle>
          <CardDescription>Hospital São Lucas • 15/06/2025</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="success">Confirmado</Badge>
        </CardContent>
      </Card>

      <Text style={{ fontSize: 14, fontWeight: "600", color: "#6b7280", marginBottom: 8 }}>LOADING SPINNER</Text>
      <View style={{ marginBottom: 20 }}>
        <LoadingSpinner label="Carregando dados..." />
      </View>

      <Text style={{ fontSize: 14, fontWeight: "600", color: "#6b7280", marginBottom: 8 }}>EMPTY STATE</Text>
      <EmptyState
        title="Nenhum agendamento"
        description="Você ainda não possui consultas agendadas. Agende agora!"
        action={<Button size="sm" onPress={() => {}}>Agendar Consulta</Button>}
      />
    </ScrollView>
  );
}

import React from "react";

export default function App() {
  if (PREVIEW_COMPONENTS) {
    return (
      <SafeAreaProvider>
        <ComponentPreview />
      </SafeAreaProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar style="auto" />
            <RootNavigator />
          </NavigationContainer>
          <Toast />
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
