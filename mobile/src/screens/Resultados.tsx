import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, RefreshControl } from "react-native";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { MedicalResult } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { EmptyState } from "@/components/EmptyState";
import { Download, FileText, FlaskConical } from "lucide-react-native";

export default function Resultados() {
  const { user } = useAuth();
  const [items, setItems] = useState<MedicalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, "results"),
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
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <PageHeader title="Resultados" subtitle="Exames e laudos médicos" />
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
            title="Nenhum resultado"
            description="Seus exames aparecerão aqui assim que ficarem prontos."
            icon={<FileText size={40} color="#9ca3af" />}
          />
        ) : (
          items.map((r) => (
            <Card key={r.id} style={{ borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{
                width: 48, height: 48, borderRadius: 12,
                backgroundColor: "rgba(14,94,112,0.1)", alignItems: "center", justifyContent: "center",
              }}>
                <FlaskConical size={20} color="#0e5e70" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827", flex: 1 }} numberOfLines={1}>
                    {r.title}
                  </Text>
                  {r.status === "processando" && (
                    <Badge variant="warning">processando</Badge>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }} numberOfLines={1}>
                  {new Date(r.date).toLocaleDateString("pt-BR")} · {r.hospitalName}
                </Text>
              </View>
              {r.fileURL ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(r.fileURL!)}
                  style={{ padding: 8, borderRadius: 20 }}
                  accessibilityLabel="Baixar laudo"
                >
                  <Download size={20} color="#1aaa86" />
                </TouchableOpacity>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
