import { ChevronRight, LogOut, Settings, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { PushNotificationToggle } from "../components/PushNotificationToggle";
import { useSessionStore } from "../store/session";

export function StudentSettingsPage() {
  const logout = useSessionStore((state) => state.logout);

  return (
    <section className="mx-auto max-w-2xl px-4 py-8 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
          <Settings className="text-emerald-700" size={18} />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Ajustes</p>
          <h1 className="text-3xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
            Configurações
          </h1>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <PushNotificationToggle />

        <Link
          to="/app/meu-cadastro"
          className="focus-ring flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-5 transition-all hover:border-emerald-400 hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <UserRound className="text-emerald-700" size={20} />
            </div>
            <div>
              <p className="font-black text-stone-950">Cadastro</p>
              <p className="text-sm text-stone-500">Altere seus dados e o tipo de perfil</p>
            </div>
          </div>
          <ChevronRight className="text-stone-400" size={20} />
        </Link>

        <button
          type="button"
          onClick={() => logout()}
          className="focus-ring flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-5 text-left transition-all hover:border-rose-300 hover:bg-rose-50/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50">
              <LogOut className="text-rose-600" size={20} />
            </div>
            <div>
              <p className="font-black text-stone-950">Sair</p>
              <p className="text-sm text-stone-500">Encerrar a sessão neste dispositivo</p>
            </div>
          </div>
          <ChevronRight className="text-stone-400" size={20} />
        </button>
      </div>
    </section>
  );
}
