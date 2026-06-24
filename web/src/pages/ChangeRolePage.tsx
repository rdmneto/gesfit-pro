import { buttonVariants } from "../components/ui/Button";
import { cardClasses } from "../components/ui/Primitives";
import { cn } from "../lib/utils";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useSessionStore } from "../store/session";

export function ChangeRolePage() {
  const user = useSessionStore((state) => state.user);
  const role = useSessionStore((state) => state.claims.role);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentRoleLabel = role === "trainer" ? "Treinador / Instrutor" : "Aluno";
  const targetRoleLabel = role === "trainer" ? "Aluno" : "Treinador / Instrutor";

  async function handleChangeRole() {
    if (!user || !db) return;
    setLoading(true);
    setError(null);
    try {
      // Clear role and teamId so onboarding picks it up fresh
      await updateDoc(doc(db, "users", user.uid), {
        role: deleteField(),
        teamId: deleteField(),
      });
      // Redirect to onboarding — the session will refresh on next auth state change
      // Force reload so custom claims are re-evaluated
      window.location.href = "/app/onboarding";
    } catch (error: unknown) { const err = error as Error;
      console.error("Erro ao mudar perfil:", err);
      setError("Não foi possível mudar o perfil. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg px-4 py-16">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="focus-ring mb-8 inline-flex items-center gap-2 text-sm font-semibold text-stone-500 hover:text-stone-900"
      >
        <ArrowLeft size={16} />
        Voltar
      </button>

      <div className={cn(cardClasses, "p-8")}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <RefreshCw className="text-amber-700" size={22} />
        </div>

        <h1 className="mt-4 text-2xl font-black text-stone-950">Mudar tipo de perfil</h1>
        <p className="mt-2 text-stone-600">
          Você está atualmente cadastrado como <strong>{currentRoleLabel}</strong>.
          Ao mudar para <strong>{targetRoleLabel}</strong>, você passará pelo cadastro novamente.
        </p>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={18} />
            <div>
              <p className="text-sm font-bold text-amber-900">Atenção</p>
              <ul className="mt-1 space-y-1 text-sm text-amber-800">
                {role === "student" ? (
                  <>
                    <li>• Seus dados de aluno (medidas, aulas) serão mantidos no histórico</li>
                    <li>• Você precisará criar ou vincular um espaço de treino</li>
                    <li>• Para voltar a ser aluno, pode usar essa mesma opção</li>
                  </>
                ) : (
                  <>
                    <li>• Seus dados de treinador serão mantidos</li>
                    <li>• Você precisará preencher o cadastro de aluno novamente</li>
                    <li>• Para voltar a ser treinador, pode usar essa mesma opção</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className={cn(buttonVariants({}), "focus-ring flex-1")}
            onClick={handleChangeRole}
            disabled={loading}
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <RefreshCw size={16} />
            )}
            {loading ? "Alterando perfil…" : `Mudar para ${targetRoleLabel}`}
          </button>
          <button
            type="button"
            className={cn(buttonVariants({}), "focus-ring flex-1")}
            onClick={() => navigate(-1)}
            disabled={loading}
          >
            Cancelar
          </button>
        </div>
      </div>
    </section>
  );
}
