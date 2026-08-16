import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/config/firebase";
import { Patient } from "@/types";

interface AuthContextValue {
  user: User | null;
  patient: Patient | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  refreshPatient: () => Promise<void>;
}

export interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  cpf: string;
  birthDate: string;
  gender: "M" | "F" | "Outro";
  phone: string;
  insurance?: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPatient = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, "patients", uid));
      if (snap.exists()) setPatient(snap.data() as Patient);
    } catch (e) {
      console.error("Erro ao carregar paciente:", e);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await loadPatient(u.uid);
      else setPatient(null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (data: SignUpData) => {
    const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
    await updateProfile(cred.user, { displayName: data.fullName });
    const patientDoc: Patient = {
      uid: cred.user.uid,
      fullName: data.fullName,
      cpf: data.cpf,
      birthDate: data.birthDate,
      gender: data.gender,
      phone: data.phone,
      email: data.email,
      insurance: data.insurance,
      createdAt: Date.now(),
    };
    await setDoc(doc(db, "patients", cred.user.uid), patientDoc);
    setPatient(patientDoc);
  };

  const signOut = async () => {
    await fbSignOut(auth);
  };

  const refreshPatient = async () => {
    if (user) await loadPatient(user.uid);
  };

  return (
    <AuthContext.Provider value={{ user, patient, loading, signIn, signUp, signOut, refreshPatient }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve estar dentro de <AuthProvider>");
  return ctx;
};
