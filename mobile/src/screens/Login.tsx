import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Toast from "react-native-toast-message";
import { HeartPulse } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { AuthStackParamList } from "@/navigation/AuthNavigator";

type LoginNavProp = NativeStackNavigationProp<AuthStackParamList, "Login">;

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { signIn } = useAuth();
  const navigation = useNavigation<LoginNavProp>();
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      await signIn(values.email, values.password);
      // RootNavigator switches automatically on auth state change
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: "Não foi possível entrar",
        text2: err?.message ?? "Verifique e-mail e senha",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero header */}
        <View style={styles.hero}>
          <View style={styles.iconWrap}>
            <HeartPulse size={32} color="#ffffff" />
          </View>
          <Text style={styles.heroTitle}>CuraDor</Text>
          <Text style={styles.heroSub}>Sua saúde em um só lugar</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Entrar</Text>
          <Text style={styles.cardSub}>Acesse seu portfólio de saúde</Text>

          <View style={{ marginTop: 24 }}>
            <Controller
              control={control}
              name="email"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  label="E-mail"
                  placeholder="voce@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                  containerStyle={{ marginBottom: 12 }}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { value, onChange, onBlur } }) => (
                <Input
                  label="Senha"
                  placeholder="••••••••"
                  secureTextEntry
                  autoComplete="current-password"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                  containerStyle={{ marginBottom: 24 }}
                />
              )}
            />

            <Button
              size="lg"
              loading={loading}
              disabled={loading}
              onPress={handleSubmit(onSubmit)}
              style={{ width: "100%" }}
            >
              Entrar
            </Button>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ainda não é cadastrado? </Text>
            <Text
              style={styles.footerLink}
              onPress={() => navigation.navigate("Cadastro")}
            >
              Criar conta
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: "#f8fafc",
  },
  hero: {
    backgroundColor: "#1aaa86",
    paddingTop: 56,
    paddingBottom: 48,
    alignItems: "center",
  },
  iconWrap: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    padding: 12,
  },
  heroTitle: {
    marginTop: 12,
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
  },
  heroSub: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
  },
  card: {
    flex: 1,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  },
  cardSub: {
    marginTop: 4,
    fontSize: 13,
    color: "#6b7280",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    fontSize: 13,
    color: "#6b7280",
  },
  footerLink: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1aaa86",
  },
});
