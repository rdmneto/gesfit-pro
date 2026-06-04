import {
  ArrowRight,
  Dumbbell,
  Globe2,
  KeyRound,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createAccount, loginWithEmail, loginWithGoogle, resetPassword } from "../lib/auth";
import { firebaseConfigured } from "../lib/firebase";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/FormFields";
import { loginSchema, signupSchema, type LoginFormData, type SignupFormData } from "../lib/schemas";
import { useSessionStore } from "../store/session";

type LoginMode = "login" | "signup" | "reset";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionUser = useSessionStore((state) => state.user);
  const sessionLoading = useSessionStore((state) => state.loading);

  const [mode, setMode] = useState<LoginMode>("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [resetEmail, setResetEmail] = useState("");

  const loginForm = useForm<LoginFormData>({ resolver: zodResolver(loginSchema), mode: "onBlur" });
  const signupForm = useForm<SignupFormData>({ resolver: zodResolver(signupSchema), mode: "onBlur" });

  useEffect(() => {
    if (!sessionLoading && sessionUser) {
      navigate("/app", { replace: true });
    }
  }, [sessionUser, sessionLoading, navigate]);

  // Vindo da vitrine de um treinador (/login?signup=1&treinador=slug):
  // abre direto a aba de criar conta e guarda o treinador para vincular
  // o aluno ao concluir o onboarding.
  useEffect(() => {
    const trainer = searchParams.get("treinador");
    if (trainer) window.sessionStorage.setItem("gesfit-pending-trainer", trainer);
    if (searchParams.get("signup") === "1") setMode("signup");
  }, [searchParams]);

  if (sessionLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
          <p className="text-sm text-stone-400">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  function switchMode(next: LoginMode) {
    setMode(next);
    setError("");
    setSuccessMsg("");
    loginForm.reset();
    signupForm.reset();
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
    <section className="mx-auto flex min-h-[calc(100vh-61px)] max-w-md flex-col justify-center px-4 py-12 animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 mb-4 shadow-sm">
          <Dumbbell size={24} />
        </div>
        <h1 className="text-3xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>
          Gesfit Pro
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Entrar ou criar conta
        </p>
        <p className="mt-1 text-xs text-stone-400">
          A escolha do perfil (aluno ou treinador) é feita após o acesso.
        </p>
      </div>

      <div className="card p-6 shadow-xl border border-stone-150 bg-white rounded-2xl">
        {/* Mode tabs */}
        <div className="flex rounded-lg border border-[var(--color-border)] bg-stone-100 p-1">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={[
                "focus-ring flex-1 rounded-md py-2.5 text-sm font-bold transition-all duration-150 cursor-pointer",
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
                Firebase não configurado — acesso indisponível.
              </p>
            )}
            <Button type="submit" variant="primary" loading={loading} disabled={!isFirebase} className="w-full" icon={<ArrowRight size={18} />}>
              Entrar
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs font-semibold text-stone-400 hover:text-emerald-700 transition-colors cursor-pointer"
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
                Firebase não configurado — acesso indisponível.
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
              className="w-full text-center text-xs font-semibold text-stone-400 hover:text-emerald-700 transition-colors cursor-pointer"
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
    </section>
  );
}
