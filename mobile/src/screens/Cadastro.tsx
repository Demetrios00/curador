import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import Toast from "react-native-toast-message";
import { ChevronLeft } from "lucide-react-native";
import { format } from "date-fns";
import { useAuth, SignUpData } from "@/contexts/AuthContext";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { AuthStackParamList } from "@/navigation/AuthNavigator";

type CadastroNavProp = NativeStackNavigationProp<AuthStackParamList, "Cadastro">;

const schema = z.object({
  fullName: z.string().min(2, "Informe o nome completo"),
  cpf: z.string().min(11, "CPF inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  insurance: z.string().optional(),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

type FormValues = z.infer<typeof schema>;

type Gender = "M" | "F" | "Outro";

export default function Cadastro() {
  const { signUp } = useAuth();
  const navigation = useNavigation<CadastroNavProp>();
  const [loading, setLoading] = useState(false);

  // Date picker state
  const [birthDate, setBirthDate] = useState<Date>(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Gender state
  const [gender, setGender] = useState<Gender>("M");

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      cpf: "",
      phone: "",
      insurance: "",
      email: "",
      password: "",
    },
  });

  const onDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selected) setBirthDate(selected);
  };

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const data: SignUpData = {
        ...values,
        birthDate: format(birthDate, "yyyy-MM-dd"),
        gender,
        insurance: values.insurance || undefined,
      };
      await signUp(data);
      // RootNavigator switches automatically on auth state change
    } catch (err: any) {
      Toast.show({
        type: "error",
        text1: "Erro ao cadastrar",
        text2: err?.message ?? "Tente novamente",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#ffffff" }}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Criar conta</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Controller
          control={control}
          name="fullName"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="Nome completo"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.fullName?.message}
              containerStyle={styles.field}
            />
          )}
        />

        <View style={styles.row}>
          <Controller
            control={control}
            name="cpf"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="CPF"
                placeholder="000.000.000-00"
                keyboardType="numeric"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.cpf?.message}
                containerStyle={[styles.field, styles.halfField]}
              />
            )}
          />

          {/* Birth date picker */}
          <View style={[styles.field, styles.halfField]}>
            <Text style={styles.fieldLabel}>Nascimento</Text>
            <TouchableOpacity
              style={styles.pickerTrigger}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.pickerTriggerText}>
                {format(birthDate, "dd/MM/yyyy")}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={birthDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                onChange={onDateChange}
              />
            )}
          </View>
        </View>

        <View style={styles.row}>
          {/* Gender picker */}
          <View style={[styles.field, styles.halfField]}>
            <Text style={styles.fieldLabel}>Gênero</Text>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={gender}
                onValueChange={(v) => setGender(v as Gender)}
                style={styles.picker}
              >
                <Picker.Item label="Masculino" value="M" />
                <Picker.Item label="Feminino" value="F" />
                <Picker.Item label="Outro" value="Outro" />
              </Picker>
            </View>
          </View>

          <Controller
            control={control}
            name="phone"
            render={({ field: { value, onChange, onBlur } }) => (
              <Input
                label="Telefone"
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.phone?.message}
                containerStyle={[styles.field, styles.halfField]}
              />
            )}
          />
        </View>

        <Controller
          control={control}
          name="insurance"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="Convênio (opcional)"
              placeholder="Ex: Unimed, SulAmérica..."
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              containerStyle={styles.field}
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="E-mail"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              containerStyle={styles.field}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label="Senha (mín. 6 caracteres)"
              secureTextEntry
              autoComplete="new-password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              containerStyle={styles.field}
            />
          )}
        />

        <Button
          size="lg"
          loading={loading}
          disabled={loading}
          onPress={handleSubmit(onSubmit)}
          style={{ width: "100%", marginTop: 8 }}
        >
          Criar conta
        </Button>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Já tenho conta? </Text>
          <Text style={styles.footerLink} onPress={() => navigation.goBack()}>
            Entrar
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  backBtn: {
    marginLeft: -4,
    padding: 4,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  field: {
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 4,
  },
  pickerTrigger: {
    height: Platform.OS === "android" ? 48 : 40,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  pickerTriggerText: {
    fontSize: 14,
    color: "#111827",
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    height: Platform.OS === "android" ? 48 : 40,
    justifyContent: "center",
  },
  picker: {
    height: Platform.OS === "android" ? 56 : 40,
    color: "#111827",
    marginTop: Platform.OS === "android" ? -4 : 0,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
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
