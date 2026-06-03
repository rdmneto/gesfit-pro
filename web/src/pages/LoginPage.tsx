import {
  ArrowRight,
  Dumbbell,
  Globe2,
  KeyRound,
  LockKeyhole,
  Mail,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { createAccount, loginWithEmail, loginWithGoogle, resetPassword } from "../lib/auth";
import { firebaseConfigured } from "../lib/firebase";
import { useSessionStore } from "../store/session";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/FormFields";
import { loginSchema, signupSchema, type LoginFormData, type SignupFormData } from "../lib/schemas";

type LoginMode = "login" | "signup" | "reset";

export function LoginPage() {
  const navigate = useNavigate();
  const loginDemo = useSessionStore((state) => state.loginDemo);

  const [mode, setMode] = useState<LoginMode>("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [resetEmail, setResetEmail] = useState("");

  const loginForm = useForm<LoginFormData>({ resolver: zodResolver(loginSchema), mode: "onBlur" });
  const signupForm = useForm<SignupFormData>({ resolver: zodResolver(signupSchema), mode: "onBlur" });

  function switchMode(next: LoginMode) {
    setMode(next);
    setError("");
    setSuccessMsg("");
    loginForm.reset();
    signupForm.reset();
  }

  function enterDemo(role: "student" | "trainer") {
    loginDemo(role);
    navigate(role === "trainer" ? "/app/treinador" : "/app");
  }

  async function handleLogin(data: LoginFormData) {
    setError("");
    setLoading(true);
    try {
      await loginWithEmail(data.email, data.password);
      navigate("/app");
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Erro desconhecido";
      if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setError("E-mail ou senha incorretos.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  async function handleSignup(data: SignupFormData) {
    setError("");
    setLoading(true);
    try {
      await createAccount(data.email, data.password, data.name);
      navigate("/app");
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Erro desconhecido";
      if (msg.includes("email-already-in-use")) {
        setError("Este e-mail já está cadastrado. Faça login.");
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  async function handleReset() {
    setError("");
    setLoading(true);
    try {
      await resetPassword(resetEmail);
      setSuccessMsg("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Erro ao enviar e-mail");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate("/app");
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Erro ao entrar com Google");
      setGoogleLoading(false);
    }
  }

  const isFirebase = firebaseConfigured;

  return (
    <section className="mx-auto grid min-h-[calc(100vh-61px)] max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center animate-fade-in">
      {/* Left column — info */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Acesso</p>
        <h1 className="mt-3 text-4xl text-stone-950">Entrar ou criar conta</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-stone-500">
          Após o login, o app libera o painel do aluno ou a área do treinador conforme seu perfil.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ProfileCard
            icon={Dumbbell}
            title="Aluno"
            body="Agenda, treinos, medidas e evolução em um só lugar."
          />
          <ProfileCard
            icon={Users}
            title="Treinador"
            body="Ambiente, alunos, agenda e vitrine pública."
          />
        </div>

        {/* Demo shortcuts */}
        <div className="mt-6 rounded-xl border border-dashed border-stone-300 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Acesso demo rápido</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="focus-ring btn btn-secondary btn-sm"
              onClick={() => enterDemo("student")}
            >
              <Dumbbell size={14} />
              Ver como aluno
            </button>
            <button
              type="button"
              className="focus-ring btn btn-secondary btn-sm"
              onClick={() => enterDemo("trainer")}
            >
              <Users size={14} />
              Ver como treinador
            </button>
          </div>
        </div>
      </div>

      {/* Right column — form */}
      <div className="grid gap-4">
        <div className="card p-6">
          {/* Mode tabs */}
          <div className="flex rounded-lg border border-[var(--color-border)] bg-stone-100 p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={[
                  "focus-ring flex-1 rounded-md py-2 text-sm font-semibold transition-all duration-150",
                  mode === m ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700",
                ].join(" ")}
                onClick={() => switchMode(m)}
              >
                {m === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          {/* LOGIN form */}
          {mode === "login" && (
            <form className="mt-5 space-y-4" onSubmit={loginForm.handleSubmit(handleLogin)}>
              <Input
                label="E-mail"
                type="email"
                placeholder="voce@email.com"
                autoComplete="email"
                leadingIcon={<Mail size={16} />}
                error={loginForm.formState.errors.email?.message}
                {...loginForm.register("email")}
              />
              <Input
                label="Senha"
                type="password"
                placeholder="Sua senha"
                autoComplete="current-password"
                leadingIcon={<LockKeyhole size={16} />}
                error={loginForm.formState.errors.password?.message}
                {...loginForm.register("password")}
              />

              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 animate-fade-in">
                  {error}
                </p>
              )}
              {!isFirebase && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  Firebase não configurado — use o acesso demo acima.
                </p>
              )}
              <Button type="submit" variant="primary" loading={loading} disabled={!isFirebase} className="w-full" icon={<ArrowRight size={18} />}>
                Entrar
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs font-semibold text-stone-400 hover:text-emerald-700 transition-colors"
                onClick={() => switchMode("reset")}
              >
                <KeyRound size={12} className="mr-1 inline" />
                Esqueci minha senha
              </button>
            </form>
          )}

          {/* SIGNUP form */}
          {mode === "signup" && (
            <form className="mt-5 space-y-4" onSubmit={signupForm.handleSubmit(handleSignup)}>
              <Input
                label="Nome completo"
                type="text"
                placeholder="Seu nome"
                autoComplete="name"
                error={signupForm.formState.errors.name?.message}
                {...signupForm.register("name")}
              />
              <Input
                label="E-mail"
                type="email"
                placeholder="voce@email.com"
                autoComplete="email"
                leadingIcon={<Mail size={16} />}
                error={signupForm.formState.errors.email?.message}
                {...signupForm.register("email")}
              />
              <Input
                label="Senha"
                type="password"
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                leadingIcon={<LockKeyhole size={16} />}
                error={signupForm.formState.errors.password?.message}
                {...signupForm.register("password")}
              />
              <Input
                label="Confirmar senha"
                type="password"
                placeholder="Repita a senha"
                autoComplete="new-password"
                leadingIcon={<LockKeyhole size={16} />}
                error={signupForm.formState.errors.confirm?.message}
                {...signupForm.register("confirm")}
              />
              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 animate-fade-in">
                  {error}
                </p>
              )}
              {!isFirebase && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  Firebase não configurado — use o acesso demo acima.
                </p>
              )}
              <Button type="submit" variant="primary" loading={loading} disabled={!isFirebase} className="w-full" icon={<ArrowRight size={18} />}>
                Criar conta
              </Button>
            </form>
          )}

          {/* RESET form */}
          {mode === "reset" && (
            <div className="mt-5 space-y-4">
              <Input
                label="E-mail cadastrado"
                type="email"
                placeholder="voce@email.com"
                autoComplete="email"
                leadingIcon={<Mail size={16} />}
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700 animate-fade-in">
                  {error}
                </p>
              )}
              {successMsg && (
                <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 animate-fade-in">
                  {successMsg}
                </p>
              )}
              <Button type="button" variant="primary" loading={loading} disabled={!isFirebase} className="w-full" icon={<ArrowRight size={18} />} onClick={handleReset}>
                Enviar e-mail de recuperação
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs font-semibold text-stone-400 hover:text-emerald-700 transition-colors"
                onClick={() => switchMode("login")}
              >
                ← Voltar ao login
              </button>
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--color-border)]" />
            <span className="text-xs text-stone-400">ou</span>
            <div className="h-px flex-1 bg-[var(--color-border)]" />
          </div>

          <Button
            variant="secondary"
            loading={googleLoading}
            disabled={!isFirebase}
            className="mt-4 w-full"
            icon={<Globe2 size={18} />}
            onClick={handleGoogle}
          >
            Continuar com Google
          </Button>
        </div>

        <section className="card p-5">
          <div className="flex items-center gap-2">
            <UserPlus aria-hidden="true" className="text-emerald-700" size={20} />
            <h2 className="text-base font-black text-stone-900">Novo por aqui?</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Escolha o tipo de conta. O aluno pode vincular um treinador agora ou depois.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link
              className="focus-ring rounded-lg border border-[var(--color-border)] bg-stone-50 p-4 transition-all hover:border-emerald-600 hover:bg-emerald-50"
              to="/cadastro/aluno"
            >
              <p className="font-black text-stone-900">Sou aluno</p>
              <p className="mt-1 text-xs text-stone-500">Criar cadastro com anamnese.</p>
            </Link>
            <Link
              className="focus-ring rounded-lg border border-[var(--color-border)] bg-stone-50 p-4 transition-all hover:border-emerald-600 hover:bg-emerald-50"
              to="/cadastro/treinador"
            >
              <p className="font-black text-stone-900">Sou treinador</p>
              <p className="mt-1 text-xs text-stone-500">Criar ambiente e divulgação.</p>
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}

function ProfileCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Dumbbell;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
        <Icon aria-hidden="true" className="text-emerald-700" size={20} />
      </div>
      <p className="mt-3 font-black text-stone-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-stone-500">{body}</p>
    </div>
  );
}
