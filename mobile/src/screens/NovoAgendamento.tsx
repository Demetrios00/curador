import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  FlatList,
} from "react-native";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Doctor, Hospital, Specialty, AppointmentType, ExamType, SurgeryType } from "@/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Loader2, ChevronDown } from "lucide-react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";

const APPOINTMENT_TYPES: { value: AppointmentType; label: string }[] = [
  { value: "consulta", label: "Consulta" },
  { value: "exame", label: "Exame" },
  { value: "cirurgia", label: "Cirurgia" },
  { value: "online", label: "Consulta online" },
];

export default function NovoAgendamento() {
  const { user } = useAuth();
  const navigation = useNavigation();

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
    <View style={{ flex: 1, backgroundColor: "#f9fafb" }}>
      <PageHeader title="Novo agendamento" showBack />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tipo */}
        <PickerField
          label="Tipo"
          value={APPOINTMENT_TYPES.find((t) => t.value === type)?.label ?? ""}
          items={APPOINTMENT_TYPES.map((t) => ({ id: t.value, name: t.label }))}
          onSelect={(id) => { setType(id as AppointmentType); setSpecialtyId(""); setDoctorId(""); }}
          placeholder="Selecione o tipo"
        />

        {/* Especialidade (consulta / online) */}
        {type !== "exame" && type !== "cirurgia" && (
          <PickerField
            label="Especialidade"
            value={specialties.find((s) => s.id === specialtyId)?.name ?? ""}
            items={specialties.map((s) => ({ id: s.id, name: s.name }))}
            onSelect={(id) => { setSpecialtyId(id); setDoctorId(""); }}
            placeholder="Selecione"
          />
        )}

        {/* Hospital */}
        <PickerField
          label="Hospital / Unidade"
          value={hospitals.find((h) => h.id === hospitalId)?.name ?? ""}
          items={hospitals.map((h) => ({ id: h.id, name: `${h.name} — ${h.city}/${h.state}` }))}
          onSelect={(id) => { setHospitalId(id); setDoctorId(""); }}
          placeholder="Selecione a unidade"
        />

        {/* Médico (opcional) */}
        {type !== "exame" && type !== "cirurgia" && filteredDoctors.length > 0 && (
          <PickerField
            label="Médico (opcional)"
            value={doctors.find((d) => d.id === doctorId)?.name ?? ""}
            items={[{ id: "", name: "Qualquer médico disponível" }, ...filteredDoctors.map((d) => ({ id: d.id, name: d.name }))]}
            onSelect={setDoctorId}
            placeholder="Qualquer médico disponível"
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
          />
        )}

        {/* Data e Hora */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 4 }}>Data</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={{
                height: 40, borderWidth: 1, borderColor: "#d1d5db",
                borderRadius: 8, paddingHorizontal: 12, flexDirection: "row",
                alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff",
              }}
            >
              <Text style={{ fontSize: 14, color: "#111827" }}>
                {selectedDate.toLocaleDateString("pt-BR")}
              </Text>
              <ChevronDown size={16} color="#9ca3af" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 4 }}>Hora</Text>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              style={{
                height: 40, borderWidth: 1, borderColor: "#d1d5db",
                borderRadius: 8, paddingHorizontal: 12, flexDirection: "row",
                alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff",
              }}
            >
              <Text style={{ fontSize: 14, color: "#111827" }}>
                {selectedDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </Text>
              <ChevronDown size={16} color="#9ca3af" />
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
}: {
  label: string;
  value: string;
  items: PickerItem[];
  onSelect: (id: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Text style={{ fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 4 }}>{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{
          height: 40, borderWidth: 1, borderColor: "#d1d5db",
          borderRadius: 8, paddingHorizontal: 12, flexDirection: "row",
          alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff",
        }}
        accessibilityLabel={label}
      >
        <Text style={{ fontSize: 14, color: value ? "#111827" : "#9ca3af", flex: 1 }} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <ChevronDown size={16} color="#9ca3af" />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setOpen(false)}
          activeOpacity={1}
        >
          <View
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
              maxHeight: "60%",
            }}
          >
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}>{label}</Text>
            </View>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => { onSelect(item.id); setOpen(false); }}
                  style={{
                    padding: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
                    backgroundColor: item.id === value ? "#f0fdf9" : "#fff",
                  }}
                >
                  <Text style={{ fontSize: 14, color: "#111827" }}>{item.name}</Text>
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
