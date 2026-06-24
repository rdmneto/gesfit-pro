import { useState } from "react";
import { CheckCircle2, RefreshCw, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useSessionStore } from "../store/session";
import { useStudent } from "../lib/hooks";
import { CITY_NAMES } from "../data/cities";

export function StudentProfilePage() {
  const user = useSessionStore((state) => state.user);
  const { data: student, loading } = useStudent(user?.uid ?? null);

  const [displayName, setDisplayName] = useState("");
  const [celular, setCelular] = useState("");
  const [city, setCity] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [genero, setGenero] = useState("");
  const [alturaCm, setAlturaCm] = useState("");
  const [pesoInicialKg, setPesoInicialKg] = useState("");
  const [goal, setGoal] = useState("");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [prevStudentStr, setPrevStudentStr] = useState("");
  const currentStudentStr = JSON.stringify(student);
  if (currentStudentStr !== prevStudentStr) {
    setPrevStudentStr(currentStudentStr);
    if (student) {
      setDisplayName(student.displayName || "");
      setCelular(student.onboarding?.celular || "");
      setCity(student.onboarding?.city || "");
      setBirthDate(student.onboarding?.birthDate || "");
      setGenero(student.onboarding?.genero || "");
      setAlturaCm(student.physiological?.alturaCm ? String(student.physiological.alturaCm) : "");
      setPesoInicialKg(
        student.physiological?.pesoInicialKg ? String(student.physiological.pesoInicialKg) : "",
      );
      setGoal(student.goal || "");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !user) return;
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await updateDoc(doc(db, "students", user.uid), {
        displayName,
        "onboarding.celular": celular,
        "onboarding.city": city,
        "onboarding.birthDate": birthDate,
        "onboarding.genero": genero,
        "physiological.alturaCm": Number(alturaCm) || null,
        "physiological.pesoInicialKg": Number(pesoInicialKg) || null,
        goal,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: unknown) { const err = error as Error;
      const msg = err instanceof Error ? err.message : "Erro desconhecido.";
      setError(msg);
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
          <UserRound className="text-emerald-700" size={18} />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Meu cadastro</p>
          <h1 className="text-3xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
            Dados pessoais
          </h1>
        </div>
      </div>
      <p className="mt-2 text-sm leading-6 text-stone-500">
        Mantenha seus dados atualizados. A cidade ajuda os treinadores da sua região a te encontrarem.
      </p>

      <form onSubmit={handleSave} className="mt-6 card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" value={displayName} onChange={setDisplayName} required />
          <Field label="Celular / WhatsApp" value={celular} onChange={setCelular} placeholder="+55 85 99999-9999" />

          <label className="block">
            <span className="text-sm font-semibold text-stone-700">Cidade</span>
            <select
              className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 bg-white px-3"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              <option value="">Selecione</option>
              {CITY_NAMES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <Field label="Data de nascimento" type="date" value={birthDate} onChange={setBirthDate} />
          <Field label="Gênero" value={genero} onChange={setGenero} placeholder="Ex: Masculino, Feminino" />
          <Field label="Altura (cm)" type="number" value={alturaCm} onChange={setAlturaCm} placeholder="Ex: 170" />
          <Field label="Peso inicial (kg)" type="number" value={pesoInicialKg} onChange={setPesoInicialKg} placeholder="Ex: 70" />
          <div className="sm:col-span-2">
            <Field label="Meta principal" value={goal} onChange={setGoal} placeholder="Ex: Hipertrofia, emagrecimento, saúde" />
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>
        )}
        {success && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="text-emerald-700" size={18} />
            <p className="text-sm font-semibold text-emerald-800">Cadastro atualizado!</p>
          </div>
        )}

        <button type="submit" className="focus-ring btn btn-primary mt-6" disabled={saving}>
          {saving ? "Salvando…" : "Salvar cadastro"}
        </button>
      </form>

      {/* Mudança de perfil */}
      <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
            <RefreshCw className="text-amber-700" size={18} />
          </div>
          <div>
            <p className="font-black text-stone-950">Tipo de perfil</p>
            <p className="text-sm text-stone-500">Você é aluno. Quer atuar como treinador?</p>
          </div>
        </div>
        <Link to="/app/mudar-perfil" className="focus-ring btn btn-outline shrink-0">
          <RefreshCw size={15} /> Virar treinador
        </Link>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      <input
        className="focus-ring mt-2 h-11 w-full rounded-md border border-stone-300 px-3"
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
