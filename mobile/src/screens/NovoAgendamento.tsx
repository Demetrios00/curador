import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  FlatList,
  Keyboard,
} from "react-native";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Doctor, Hospital, Specialty, AppointmentType, ExamType, SurgeryType, ReferralPrefill, AppointmentPrefill } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loader2, ChevronDown, Info } from "lucide-react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import Toast from "react-native-toast-message";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "@/contexts/ThemeContext";
import type { ThemePalette } from "@/theme/colors";

const APPOINTMENT_TYPES: { value: AppointmentType; label: string }[] = [
  { value: "consulta", label: "Consulta" },
  { value: "exame", label: "Exame" },
  { value: "cirurgia", label: "Cirurgia" },
  { value: "online", label: "Consulta online" },
];

/**
 * Aviso exibido quando a tela é aberta a partir de um prefill — encaminhamento
 * (Ideia 3) ou remarcação de agendamento cancelado (Ideia 5). A mensagem final
 * já vem pronta de quem populou o estado (cada prefill tem sua própria lógica
 * de casamento/fallback), em vez de a própria UI recalcular o texto a partir
 * de flags soltas.
 */
interface PrefillNotice {
  message: string;
}

/**
 * Ideia 2 — extensão de escopo (03/09/2026): esta tela ficava fora do escopo
 * reduzido original (`claude/ideia2-tema-dark-light-proposta.md`) — só o
 * campo "Observações" (via `Input`, já themeado) acompanhava o tema; o
 * restante da tela (seletores de tipo/especialidade/unidade/médico, campos
 * de data/hora, modal de seleção) era código próprio, com cores fixas.
 * Retemado por completo nesta rodada, junto com Unidades Próximas e Agente
 * IA.
 */
export default function NovoAgendamento() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  // Esta tela é montada tanto como a própria aba "Agendar" (sem stack) quanto
  // como rota "NovoAgendamento" de uma stack — os dois `ParamList` declaram
  // `{ prefill?: ReferralPrefill } | undefined`, então o cast é seguro.
  const prefill = (route.params as { prefill?: ReferralPrefill | AppointmentPrefill } | undefined)?.prefill;

  const [type, setType] = useState<AppointmentType>("consulta");
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [surgeryTypes, setSurgeryTypes] = useState<SurgeryType[]>([]);
  const [hospitalId, setHospitalId] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [examTypeId, setExamTypeId] = useState("");
  const [surgeryTypeId, setSurgeryTypeId] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [prefillNotice, setPrefillNotice] = useState<PrefillNotice | null>(null);
  // Guardam o id já aplicado de cada tipo de prefill, para não reaplicar
  // repetidamente enquanto esta tela permanece montada (ela não desmonta ao
  // trocar de aba). Dois refs separados — um por tipo de prefill — porque um
  // `sourceReferralId` e um `sourceAppointmentId` são espaços de IDs
  // independentes (documentos de coleções diferentes).
  const appliedReferralPrefillIdRef = useRef<string | null>(null);
  const appliedAppointmentPrefillIdRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [h, s, d, e, c] = await Promise.all([
          getDocs(collection(db, "hospitals")),
          getDocs(collection(db, "specialties")),
          getDocs(collection(db, "doctors")),
          getDocs(collection(db, "examTypes")),
          getDocs(collection(db, "surgeryTypes")),
        ]);
        setHospitals(h.docs.map((x) => ({ id: x.id, ...(x.data() as any) })));
        setSpecialties(s.docs.map((x) => ({ id: x.id, ...(x.data() as any) })));
        setDoctors(d.docs.map((x) => ({ id: x.id, ...(x.data() as any) })));
        setExamTypes(e.docs.map((x) => ({ id: x.id, ...(x.data() as any) })));
        setSurgeryTypes(c.docs.map((x) => ({ id: x.id, ...(x.data() as any) })));
      } catch (err) {
        console.error("Falha ao carregar dados:", err);
      }
    })();
  }, []);

  /**
   * Ideia 3 (claude/avaliacao-evolucao-pre-fase8.md): aplica o prefill vindo
   * de "Encaminhamentos", quando presente.
   *
   * Para `type === "consulta"`, tenta casar `specialtyName` com a lista de
   * `specialties` (mesmo padrão de casamento por nome já usado no Agente de
   * Instruções, Fase 6). Para `type === "cirurgia"`, NÃO tenta preencher
   * "Tipo de cirurgia" — `referrals.specialty` é uma especialidade médica
   * (ex.: "Ortopedia"), enquanto `surgeryTypes` são procedimentos específicos
   * (ex.: "Cirurgia de ombro"); são taxonomias diferentes, e um casamento por
   * nome aqui arriscaria selecionar o procedimento errado silenciosamente.
   *
   * Espera `specialties` carregar antes de rodar (para "consulta"), para não
   * tentar casar contra uma lista ainda vazia.
   */
  useEffect(() => {
    if (!prefill || !("sourceReferralId" in prefill)) return;
    if (appliedReferralPrefillIdRef.current === prefill.sourceReferralId) return;
    if (prefill.type === "consulta" && specialties.length === 0) return;

    appliedReferralPrefillIdRef.current = prefill.sourceReferralId;

    setType(prefill.type);
    setDoctorId("");
    setHospitalId("");

    if (prefill.type === "consulta") {
      const matched = specialties.find(
        (s) => s.name.trim().toLowerCase() === prefill.specialtyName.trim().toLowerCase()
      );
      setSpecialtyId(matched?.id ?? "");
      setPrefillNotice({
        message: matched
          ? `Preenchido a partir do encaminhamento de ${prefill.specialtyName}. Confira a unidade, data e horário antes de confirmar.`
          : `Encaminhamento para ${prefill.specialtyName}, mas não encontramos essa especialidade no cadastro — selecione manualmente.`,
      });
    } else {
      setSpecialtyId("");
      setPrefillNotice({
        message: `Encaminhamento de cirurgia (${prefill.specialtyName}) — selecione o tipo de cirurgia, a unidade, a data e o horário.`,
      });
    }
  }, [prefill, specialties]);

  /**
   * Ideia 5 (claude/avaliacao-ajustes-2.0.md): aplica o prefill vindo de
   * "Agendamentos" ao remarcar um agendamento cancelado. Diferente do prefill
   * de encaminhamento acima, aqui `hospitalId`/`specialtyId`/`doctorId` já são
   * IDs reais do agendamento original — reaproveitados diretamente, sem
   * casamento por nome. Só "exame"/"cirurgia" precisam de casamento por nome
   * (`examOrSurgeryName` contra `examTypes`/`surgeryTypes`), porque
   * `Appointment` não guarda o ID desses catálogos, só o nome já resolvido em
   * `title` no momento em que o agendamento original foi criado.
   *
   * Data e horário são deliberadamente deixados como estão (valor padrão do
   * formulário) — a Ideia 5 exige nova escolha manual, nunca reaproveitar a
   * data do agendamento cancelado.
   */
  useEffect(() => {
    if (!prefill || !("sourceAppointmentId" in prefill)) return;
    if (appliedAppointmentPrefillIdRef.current === prefill.sourceAppointmentId) return;
    if (hospitals.length === 0) return;
    if (prefill.type === "exame" && examTypes.length === 0) return;
    if (prefill.type === "cirurgia" && surgeryTypes.length === 0) return;

    appliedAppointmentPrefillIdRef.current = prefill.sourceAppointmentId;

    setType(prefill.type);
    setHospitalId(prefill.hospitalId);
    setDoctorId(prefill.doctorId ?? "");

    const genericMessage =
      "Preenchido a partir do agendamento cancelado. Confira a unidade, data e horário antes de confirmar.";

    if (prefill.type === "exame") {
      const matched = examTypes.find(
        (x) => x.name.trim().toLowerCase() === (prefill.examOrSurgeryName ?? "").trim().toLowerCase()
      );
      setExamTypeId(matched?.id ?? "");
      setSpecialtyId("");
      setSurgeryTypeId("");
      setPrefillNotice({
        message: matched
          ? genericMessage
          : `O agendamento cancelado era do exame "${prefill.examOrSurgeryName}", mas não encontramos esse exame no cadastro — selecione manualmente.`,
      });
    } else if (prefill.type === "cirurgia") {
      const matched = surgeryTypes.find(
        (x) => x.name.trim().toLowerCase() === (prefill.examOrSurgeryName ?? "").trim().toLowerCase()
      );
      setSurgeryTypeId(matched?.id ?? "");
      setSpecialtyId("");
      setExamTypeId("");
      setPrefillNotice({
        message: matched
          ? genericMessage
          : `O agendamento cancelado era da cirurgia "${prefill.examOrSurgeryName}", mas não encontramos esse procedimento no cadastro — selecione manualmente.`,
      });
    } else {
      // consulta / online — specialtyId já é o ID real do agendamento original.
      setSpecialtyId(prefill.specialtyId ?? "");
      setExamTypeId("");
      setSurgeryTypeId("");
      setPrefillNotice({ message: genericMessage });
    }
  }, [prefill, hospitals, examTypes, surgeryTypes]);

  const filteredDoctors = useMemo(
    () =>
      doctors.filter(
        (d) =>
          (!specialtyId || d.specialtyId === specialtyId) &&
          (!hospitalId || d.hospitalIds?.includes(hospitalId))
      ),
    [doctors, specialtyId, hospitalId]
  );

  const handleSubmit = async () => {
    if (!user) return;
    if (!hospitalId) {
      Toast.show({ type: "error", text1: "Selecione o hospital / unidade" });
      return;
    }
    if (type === "exame" && !examTypeId) {
      Toast.show({ type: "error", text1: "Selecione o tipo de exame" });
      return;
    }
    if (type === "cirurgia" && !surgeryTypeId) {
      Toast.show({ type: "error", text1: "Selecione o tipo de cirurgia" });
      return;
    }

    setSaving(true);
    try {
      const hospital = hospitals.find((h) => h.id === hospitalId);
      const doctor = doctors.find((d) => d.id === doctorId);
      const specialty = specialties.find((s) => s.id === specialtyId);
      const exam = examTypes.find((x) => x.id === examTypeId);
      const surgery = surgeryTypes.find((x) => x.id === surgeryTypeId);
      const computedTitle =
        type === "consulta"
          ? `Consulta ${specialty?.name ?? ""}`.trim()
          : type === "exame"
          ? (exam?.name ?? "Exame")
          : type === "cirurgia"
          ? (surgery?.name ?? "Cirurgia")
          : `Consulta online ${specialty?.name ?? ""}`.trim();

      await addDoc(collection(db, "appointments"), {
        patientUid: user.uid,
        type,
        title: computedTitle,
        doctorId: doctorId || null,
        doctorName: doctor?.name ?? null,
        specialtyId: specialtyId || null,
        hospitalId,
        hospitalName: hospital?.name ?? "",
        date: selectedDate.toISOString(),
        status: "agendado",
        notes: notes || null,
        createdAt: Date.now(),
      });
      Toast.show({ type: "success", text1: "Agendamento criado!" });
      setPrefillNotice(null);
      navigation.goBack();
    } catch (err: any) {
      Toast.show({ type: "error", text1: "Erro ao agendar", text2: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const onDateChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate((prev) => {
        const next = new Date(prev);
        next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        return next;
      });
    }
  };

  const onTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      setSelectedDate((prev) => {
        const next = new Date(prev);
        next.setHours(date.getHours(), date.getMinutes());
        return next;
      });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PageHeader title="Novo agendamento" showBack />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Aviso de pré-preenchimento a partir de um encaminhamento (Ideia 3) */}
        {prefillNotice ? (
          <View
            style={{
              flexDirection: "row", alignItems: "flex-start", gap: 10,
              borderRadius: 12, padding: 12,
              backgroundColor: "rgba(26,170,134,0.08)",
              borderWidth: 1, borderColor: "rgba(26,170,134,0.25)",
            }}
          >
            <Info size={16} color={colors.primary} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 }}>
              {prefillNotice.message}
            </Text>
          </View>
        ) : null}

        {/* Tipo */}
        <PickerField
          label="Tipo"
          value={APPOINTMENT_TYPES.find((t) => t.value === type)?.label ?? ""}
          items={APPOINTMENT_TYPES.map((t) => ({ id: t.value, name: t.label }))}
          onSelect={(id) => { setType(id as AppointmentType); setSpecialtyId(""); setDoctorId(""); }}
          placeholder="Selecione o tipo"
          colors={colors}
        />

        {/* Especialidade (consulta / online) */}
        {type !== "exame" && type !== "cirurgia" && (
          <PickerField
            label="Especialidade"
            value={specialties.find((s) => s.id === specialtyId)?.name ?? ""}
            items={specialties.map((s) => ({ id: s.id, name: s.name }))}
            onSelect={(id) => { setSpecialtyId(id); setDoctorId(""); }}
            placeholder="Selecione"
            colors={colors}
          />
        )}

        {/* Hospital */}
        <PickerField
          label="Hospital / Unidade"
          value={hospitals.find((h) => h.id === hospitalId)?.name ?? ""}
          items={hospitals.map((h) => ({ id: h.id, name: `${h.name} — ${h.city}/${h.state}` }))}
          onSelect={(id) => { setHospitalId(id); setDoctorId(""); }}
          placeholder="Selecione a unidade"
          colors={colors}
        />

        {/* Médico (opcional) */}
        {type !== "exame" && type !== "cirurgia" && filteredDoctors.length > 0 && (
          <PickerField
            label="Médico (opcional)"
            value={doctors.find((d) => d.id === doctorId)?.name ?? ""}
            items={[{ id: "", name: "Qualquer médico disponível" }, ...filteredDoctors.map((d) => ({ id: d.id, name: d.name }))]}
            onSelect={setDoctorId}
            placeholder="Qualquer médico disponível"
            colors={colors}
          />
        )}

        {/* Tipo de exame */}
        {type === "exame" && hospitalId && (
          <PickerField
            label="Tipo de exame"
            value={examTypes.find((x) => x.id === examTypeId)?.name ?? ""}
            items={examTypes.map((x) => ({ id: x.id, name: x.name }))}
            onSelect={setExamTypeId}
            placeholder="Selecione o exame"
            colors={colors}
          />
        )}

        {/* Tipo de cirurgia */}
        {type === "cirurgia" && (
          <PickerField
            label="Tipo de cirurgia"
            value={surgeryTypes.find((x) => x.id === surgeryTypeId)?.name ?? ""}
            items={surgeryTypes.map((x) => ({ id: x.id, name: x.name }))}
            onSelect={setSurgeryTypeId}
            placeholder="Selecione a cirurgia"
            colors={colors}
          />
        )}

        {/* Data e Hora */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textMuted, marginBottom: 4 }}>Data</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={{
                height: 40, borderWidth: 1, borderColor: colors.borderInput,
                borderRadius: 8, paddingHorizontal: 12, flexDirection: "row",
                alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface,
              }}
            >
              <Text style={{ fontSize: 14, color: colors.text }}>
                {selectedDate.toLocaleDateString("pt-BR")}
              </Text>
              <ChevronDown size={16} color={colors.textSubtle} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textMuted, marginBottom: 4 }}>Hora</Text>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              style={{
                height: 40, borderWidth: 1, borderColor: colors.borderInput,
                borderRadius: 8, paddingHorizontal: 12, flexDirection: "row",
                alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface,
              }}
            >
              <Text style={{ fontSize: 14, color: colors.text }}>
                {selectedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <ChevronDown size={16} color={colors.textSubtle} />
            </TouchableOpacity>
          </View>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}
        {showTimePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onTimeChange}
          />
        )}

        {/* Observações */}
        <Input
          label="Observações (opcional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={{ height: 80, textAlignVertical: "top" }}
          placeholder="Alguma informação adicional..."
          // Ideia 2.0-#1 (claude/avaliacao-ajustes-2.0.md): decisão aprovada
          // — Enter aqui só fecha o teclado, NÃO aciona "Confirmar
          // agendamento" (é o último campo antes desse botão, sem "próximo"
          // para ir). Primeira tentativa interceptava a quebra de linha via
          // `onChangeText`, mas isso se mostrou pouco confiável no teste
          // real (mesmo problema encontrado no chat do Agente IA).
          // `submitBehavior="submit"` é a solução nativa do RN (0.74+) para
          // isso, disparando `onSubmitEditing` no Enter em vez de inserir a
          // quebra, mesmo em campo `multiline`.
          submitBehavior="submit"
          onSubmitEditing={() => Keyboard.dismiss()}
        />

        <Button
          onPress={handleSubmit}
          disabled={saving}
          loading={saving}
          size="lg"
          style={{ marginTop: 8, marginBottom: 32 }}
        >
          {saving ? "Salvando..." : "Confirmar agendamento"}
        </Button>
      </ScrollView>
    </View>
  );
}

interface PickerItem { id: string; name: string; }

function PickerField({
  label,
  value,
  items,
  onSelect,
  placeholder,
  colors,
}: {
  label: string;
  value: string;
  items: PickerItem[];
  onSelect: (id: string) => void;
  placeholder: string;
  colors: ThemePalette;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Text style={{ fontSize: 14, fontWeight: "500", color: colors.textMuted, marginBottom: 4 }}>{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{
          height: 40, borderWidth: 1, borderColor: colors.borderInput,
          borderRadius: 8, paddingHorizontal: 12, flexDirection: "row",
          alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface,
        }}
        accessibilityLabel={label}
      >
        <Text style={{ fontSize: 14, color: value ? colors.text : colors.textSubtle, flex: 1 }} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <ChevronDown size={16} color={colors.textSubtle} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: colors.overlay }}
          onPress={() => setOpen(false)}
          activeOpacity={1}
        >
          <View
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
              maxHeight: "60%",
            }}
          >
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>{label}</Text>
            </View>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { onSelect(item.id); setOpen(false); }}
                  style={{
                    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
                    backgroundColor: item.id === value ? "rgba(26,170,134,0.08)" : colors.surface,
                  }}
                >
                  <Text style={{ fontSize: 14, color: colors.text }}>{item.name}</Text>
                </TouchableOpacity>
              )}
              style={{ paddingBottom: 32 }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
