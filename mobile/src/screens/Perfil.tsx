import { View, Text, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from "react-native";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Camera, Mail, Phone, ShieldCheck, User as UserIcon } from "lucide-react-native";
import Toast from "react-native-toast-message";
import * as ImagePicker from "expo-image-picker";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/config/firebase";

export default function Perfil() {
  const { patient, user, signOut, refreshPatient } = useAuth();
  const [uploading, setUploading] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      Toast.show({ type: "success", text1: "Você saiu da conta" });
    } catch (e) {
      Toast.show({ type: "error", text1: "Erro ao sair" });
    }
  };

  const pickImage = async (fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permissão necessária", "Precisamos de acesso para continuar.");
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true });

    if (result.canceled || !result.assets[0]) return;

    try {
      setUploading(true);
      const base64 = result.assets[0].base64;
      if (!base64) throw new Error("base64 não retornado pelo picker");

      const photoURL = `data:image/jpeg;base64,${base64}`;
      const uid = user!.uid;
      await updateDoc(doc(db, "patients", uid), { photoURL });
      await refreshPatient();
      Toast.show({ type: "success", text1: "Foto atualizada!" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Perfil] Erro ao salvar foto:", msg, e);
      Toast.show({ type: "error", text1: "Erro ao salvar a foto", text2: msg });
    } finally {
      setUploading(false);
    }
  };

  const handleChangePhoto = () => {
    Alert.alert("Foto de perfil", "Escolha uma opção", [
      { text: "Câmera", onPress: () => pickImage(true) },
      { text: "Galeria", onPress: () => pickImage(false) },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <PageHeader
        title="Meu perfil"
        variant="hero"
        subtitle={patient?.fullName ?? user?.email ?? ""}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={{ alignItems: "center", marginBottom: 4 }}>
          <TouchableOpacity onPress={handleChangePhoto} disabled={uploading} activeOpacity={0.8}>
            <View style={{
              width: 96, height: 96, borderRadius: 48,
              backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center",
              overflow: "hidden", borderWidth: 3, borderColor: "#fff",
              shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
            }}>
              {uploading ? (
                <ActivityIndicator color="#6b7280" />
              ) : patient?.photoURL ? (
                <Image
                  source={{ uri: patient.photoURL }}
                  style={{ width: 96, height: 96 }}
                  resizeMode="cover"
                />
              ) : (
                <UserIcon size={40} color="#9ca3af" />
              )}
            </View>
            <View style={{
              position: "absolute", bottom: 0, right: 0,
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center",
              borderWidth: 2, borderColor: "#fff",
            }}>
              <Camera size={13} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        <Card style={{ borderRadius: 16, padding: 20, gap: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#6b7280" }}>Dados pessoais</Text>
          <Row icon={UserIcon} label="Nome" value={patient?.fullName ?? "-"} />
          <Row icon={Mail} label="E-mail" value={patient?.email ?? user?.email ?? "-"} />
          <Row icon={Phone} label="Telefone" value={patient?.phone ?? "-"} />
          <Row icon={ShieldCheck} label="Convênio" value={patient?.insurance || "Particular"} />
        </Card>

        <Card style={{ borderRadius: 16, padding: 20, gap: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#6b7280" }}>Documentos</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 14, color: "#6b7280" }}>CPF</Text>
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#111827" }}>
              {patient?.cpf ?? "-"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 14, color: "#6b7280" }}>Nascimento</Text>
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#111827" }}>
              {patient?.birthDate
                ? new Date(patient.birthDate).toLocaleDateString("pt-BR")
                : "-"}
            </Text>
          </View>
        </Card>

        <Button variant="outline" onPress={handleLogout} style={{ height: 48 }}>
          Sair da conta
        </Button>

        <Text style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", paddingBottom: 16 }}>
          CuraDor v1.0 · Rede CuraD'Or
        </Text>
      </ScrollView>
    </View>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{
        width: 36, height: 36, borderRadius: 8,
        backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={16} color="#6b7280" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: "#6b7280" }}>{label}</Text>
        <Text style={{ fontSize: 14, fontWeight: "500", color: "#111827" }} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}
