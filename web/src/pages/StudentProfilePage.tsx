import { buttonVariants } from "../components/ui/Button";
import { cardClasses } from "../components/ui/Primitives";
import { cn } from "../lib/utils";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, RefreshCw, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useSessionStore } from "../store/session";
import { useStudent } from "../lib/hooks";
import { CITY_NAMES } from "../data/cities";
import { Input, SelectField } from "../components/ui/FormFields";
import { studentProfileSchema, type StudentProfileData } from "../lib/schemas";
import { queryClient } from "../main";

export function StudentProfilePage() {
  const user = useSessionStore((state) => state.user);
  const { data: student, loading } = useStudent(user?.uid ?? null);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const form = useForm<StudentProfileData>({
    resolver: zodResolver(studentProfileSchema) as any,
    defaultValues: {
      displayName: "",
      celular: "",
      cidade: "",
      birthDate: "",
      genero: "",
      alturaCm: undefined,
      pesoInicialKg: undefined,
      objetivos: "",
    },
  });

  useEffect(() => {
    if (student) {
      form.reset({
        displayName: student.displayName || "",
        celular: student.onboarding?.celular || "",
        cidade: student.onboarding?.city || "",
        birthDate: student.onboarding?.birthDate || "",
        genero: student.onboarding?.genero || "",
        alturaCm: student.physiological?.alturaCm || undefined,
        pesoInicialKg: student.physiological?.pesoInicialKg || undefined,
        objetivos: student.goal || "",
      });
    }
  }, [student, form]);

  async function handleSave(data: StudentProfileData) {
    if (!db || !user) return;
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await updateDoc(doc(db, "students", user.uid), {
        displayName: data.displayName,
        "onboarding.celular": data.celular || "",
        "onboarding.city": data.cidade || "",
        "onboarding.birthDate": data.birthDate || "",
        "onboarding.genero": data.genero || "",
        "physiological.alturaCm": data.alturaCm || null,
        "physiological.pesoInicialKg": data.pesoInicialKg || null,
        goal: data.objetivos || "",
      });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: unknown) {
      const err = error as Error;
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

      <form onSubmit={form.handleSubmit(handleSave)} className={cn(cardClasses, "mt-6  p-6")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nome completo" {...form.register("displayName")} error={form.formState.errors.displayName?.message} required />
          <Input label="Celular / WhatsApp" {...form.register("celular")} error={form.formState.errors.celular?.message} placeholder="+55 85 99999-9999" />

          <SelectField label="Cidade" {...form.register("cidade")} error={form.formState.errors.cidade?.message}>
            <option value="">Selecione</option>
            {CITY_NAMES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </SelectField>

          <Input label="Data de nascimento" type="date" {...form.register("birthDate")} error={form.formState.errors.birthDate?.message} />
          <Input label="Gênero" {...form.register("genero")} error={form.formState.errors.genero?.message} placeholder="Ex: Masculino, Feminino" />
          <Input label="Altura (cm)" type="number" {...form.register("alturaCm")} error={form.formState.errors.alturaCm?.message} placeholder="Ex: 170" />
          <Input label="Peso inicial (kg)" type="number" step="0.1" {...form.register("pesoInicialKg")} error={form.formState.errors.pesoInicialKg?.message} placeholder="Ex: 70" />
          <div className="sm:col-span-2">
            <Input label="Meta principal" {...form.register("objetivos")} error={form.formState.errors.objetivos?.message} placeholder="Ex: Hipertrofia, emagrecimento, saúde" />
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

        <button type="submit" className={cn(buttonVariants({}), "focus-ring mt-6")} disabled={saving}>
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
        <Link to="/app/mudar-perfil" className={cn(buttonVariants({}), "focus-ring shrink-0")}>
          <RefreshCw size={15} /> Virar treinador
        </Link>
      </div>
    </section>
  );
}

