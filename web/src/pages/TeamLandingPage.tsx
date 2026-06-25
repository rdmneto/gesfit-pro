import { useState, useMemo } from "react";
import { ArrowRight, CalendarDays, Check, LockKeyhole, ShieldCheck, Tag, MessageSquare, UserPlus, UserCheck, MapPin, Home, Building2, Clock, Copy, CheckCheck } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { moneyFromCents } from "../lib/format";
import { hasStock, visiblePublic } from "../lib/products";
import { useLiveCollection, useClassProducts } from "../lib/hooks";
import { useSessionStore } from "../store/session";
import { useActiveTrainer } from "../lib/activeTrainer";
import { requestEnrollment } from "../lib/enrollments";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import type { Team } from "../types/domain";
import { queryClient } from "../main";

export function TeamLandingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const user = useSessionStore((state) => state.user);
  const role = useSessionStore((state) => state.claims.role);
  const activeTrainerId = useActiveTrainer((state) => state.activeTrainerId);
  const setActiveTrainer = useActiveTrainer((state) => state.setActiveTrainer);

  // Busca o time pelo slug no Firestore
  const { data: dbTeams, loading: teamsLoading } = useLiveCollection<Team>(
    "teams",
    slug ? [where("slug", "==", slug), where("publicListing", "==", true)] : [],
    [],
    [slug]
  );

  const team = useMemo(() => (dbTeams && dbTeams.length > 0 ? dbTeams[0] : null), [dbTeams]);

  const teamId = team?.id;

  // Busca os planos e pacotes do time
  const { data: dbProducts, loading: productsLoading } = useClassProducts(teamId ?? null);

  const products = useMemo(
    () => (dbProducts || []).filter((p) => p.active && visiblePublic(p) && hasStock(p)),
    [dbProducts],
  );


  const [netLoading, setNetLoading] = useState(false);
  const [netMessage, setNetMessage] = useState("");
  const [copiedPix, setCopiedPix] = useState(false);

  if (teamsLoading || productsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
          <p className="text-sm text-stone-400">Carregando vitrine...</p>
        </div>
      </div>
    );
  }

  if (!team) {
    return <Navigate to="/treinadores" replace />;
  }

  // Ação de "Contratar" ciente do estado de login:
  // - visitante → cria conta (já marcando este treinador)
  // - logado sem perfil → completa o cadastro (onboarding)
  // - aluno → solicita vínculo com este treinador (pending) e o torna ativo
  // - treinador → volta ao painel
  async function handleContract() {
    if (team?.slug) {
      window.sessionStorage.setItem("gesfit-pending-trainer", team.slug);
    }
    if (!user) {
      navigate(`/login?signup=1&treinador=${team?.slug ?? ""}`);
      return;
    }
    if (!role) {
      navigate("/app/onboarding");
      return;
    }
    if (role === "trainer") {
      navigate("/app");
      return;
    }
    if (db && team?.id) {
      try {
        await requestEnrollment(db, {
          studentId: user.uid,
          studentName: user.displayName || "Aluno",
          trainerId: team.id,
          teamName: team.name,
        });
        // Só adota o novo treinador como ativo se o aluno ainda não tem um —
        // assim, contratar um treinador adicional não tira o contexto atual.
        if (!activeTrainerId) setActiveTrainer(team.id);
      } catch (error: unknown) { const err = error as Error;
        console.error("Erro ao solicitar vínculo com o treinador:", err);
      }
    }
    navigate("/app/meus-treinadores");
  }

  const isTrainerAndNotMe = role === "trainer" && user?.uid !== team.ownerUid;
  const isMyTeam = role === "trainer" && user?.uid === team.ownerUid;

  async function handleRequestJoin() {
    if (!db || !user || !team) return;
    setNetLoading(true);
    setNetMessage("");
    try {
      const existingQ = query(
        collection(db, "teamMembers"),
        where("ownerUid", "==", team.ownerUid),
        where("subTrainerId", "==", user.uid)
      );
      const snap = await getDocs(existingQ);
      if (!snap.empty && snap.docs.some(d => d.data().status !== "removed")) {
        setNetMessage("Vínculo ou convite já existente.");
        setNetLoading(false);
        return;
      }
      const memberId = `${team.ownerUid}__${user.uid}`;
      await setDoc(doc(db, "teamMembers", memberId), {
        id: memberId,
        ownerUid: team.ownerUid,
        ownerName: team.name,
        subTrainerId: user.uid,
        subTrainerName: user.displayName || "Treinador",
        subTrainerEmail: user.email,
        status: "requesting_join",
        invitedAt: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
      setNetMessage("Solicitação enviada!");
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setNetMessage("Erro: " + err.message);
    }
    setNetLoading(false);
  }

  async function handleInviteToMyTeam() {
    if (!db || !user || !team) return;
    setNetLoading(true);
    setNetMessage("");
    try {
      const existingQ = query(
        collection(db, "teamMembers"),
        where("ownerUid", "==", user.uid),
        where("subTrainerId", "==", team.ownerUid)
      );
      const snap = await getDocs(existingQ);
      if (!snap.empty && snap.docs.some(d => d.data().status !== "removed")) {
        setNetMessage("Vínculo ou convite já existente.");
        setNetLoading(false);
        return;
      }
      const memberId = `${user.uid}__${team.ownerUid}`;
      await setDoc(doc(db, "teamMembers", memberId), {
        id: memberId,
        ownerUid: user.uid,
        ownerName: user.displayName || "",
        subTrainerId: team.ownerUid,
        subTrainerName: team.name,
        subTrainerEmail: "",
        status: "pending",
        invitedAt: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
      setNetMessage("Convite enviado!");
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setNetMessage("Erro: " + err.message);
    }
    setNetLoading(false);
  }

  async function handleStartChat() {
    if (!db || !user || !team) return;
    setNetLoading(true);
    setNetMessage("");
    try {
      const ids = [user.uid, team.ownerUid].sort();
      const chatId = `${ids[0]}__${ids[1]}`;
      
      await setDoc(doc(db, "trainerChats", chatId), {
        id: chatId,
        requesterId: user.uid,
        requesterName: user.displayName || "Treinador",
        targetId: team.ownerUid,
        targetName: team.name,
        status: "accepted",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
      setNetMessage("");
      window.dispatchEvent(new CustomEvent("openGlobalChat", { 
        detail: { 
          chatId, 
          type: "trainerChat", 
          otherUserId: team.ownerUid, 
          otherUserName: team.name 
        } 
      }));
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setNetMessage("Erro: " + err.message);
    }
    setNetLoading(false);
  }

  const primary = team.branding?.primaryColor || "#0f766e";
  const secondary = team.branding?.secondaryColor || "#f59e0b";

  return (
    <div className="pb-24">
      <section
        className="relative min-h-[64vh] bg-stone-950 text-white"
        style={{
          backgroundImage: `linear-gradient(90deg, ${primary}F0, ${primary}55), url(${team.branding?.bannerPhotoURL || team.branding?.heroPhotoURL || "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=1600&q=80"})`,
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <span
          className="absolute left-0 top-0 h-full w-2"
          style={{ backgroundColor: secondary }}
        />
        <div className="mx-auto flex min-h-[64vh] max-w-6xl flex-col justify-center px-4 py-16">
          <h1 className="max-w-3xl text-4xl font-black leading-tight sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
            {team.name}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-stone-100">
            {team.branding?.welcomeMessage || "Treino sério e acompanhamento personalizado."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {!isMyTeam && !isTrainerAndNotMe && (
              <button
                type="button"
                className="focus-ring inline-flex h-11 items-center gap-2 rounded-md px-5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
                style={{ backgroundColor: primary }}
                onClick={handleContract}
              >
                Contratar Treinador
                <ArrowRight aria-hidden="true" size={16} />
              </button>
            )}
            {!user && (
              <Link
                className="focus-ring inline-flex h-11 items-center gap-2 rounded-md bg-white px-5 text-sm font-bold text-stone-950 hover:bg-stone-100 transition-colors"
                to="/login"
              >
                Já sou aluno
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>Perfil do treinador</h2>
            {team.publicProfile?.showPhotos && team.branding?.trainerPhotoURL ? (
              <img
                className="mt-4 h-36 w-36 rounded-lg object-cover"
                src={team.branding.trainerPhotoURL}
                alt={`Foto de ${team.name}`}
              />
            ) : null}
            <p className="mt-2 text-stone-600 leading-relaxed text-sm">{team.branding?.bio || "Sem biografia cadastrada."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(team.trainingModalities || []).map((modality) => (
                <span
                  key={modality}
                  className="rounded-md border-l-2 bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-700"
                  style={{ borderLeftColor: secondary }}
                >
                  {modality}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-emerald-250 bg-emerald-50/50 p-4 text-emerald-950">
              <ShieldCheck aria-hidden="true" className="text-emerald-700 shrink-0 mt-0.5" size={20} />
              <p className="text-xs leading-5">
                Visitantes podem consultar as informações divulgadas. A contratação fica liberada após
                cadastro, aceite de contrato e consentimento LGPD.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {team.publicProfile?.showPrices && products.length > 0 ? (
              products.map((product) => (
                <article key={product.id} className="rounded-lg border border-stone-200 bg-white p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Tag aria-hidden="true" style={{ color: primary }} size={18} />
                      <h3 className="text-base font-bold text-stone-900">{product.name}</h3>
                    </div>
                    <p className="mt-2 text-3xl font-black" style={{ fontFamily: "var(--font-display)", color: primary }}>{moneyFromCents(product.priceCents)}</p>
                    <p className="text-xs text-stone-500">
                      {product.type === "single" ? "aula avulsa" : `${product.classesCount} aulas`}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-stone-600">{product.description}</p>
                    <ul className="mt-5 space-y-2.5 text-xs text-stone-600">
                      <li className="flex gap-2">
                        <Check aria-hidden="true" className="text-emerald-700 shrink-0" size={16} />
                        Crédito de {product.classesCount} aula{product.classesCount > 1 ? "s" : ""}
                      </li>
                      <li className="flex gap-2">
                        <LockKeyhole aria-hidden="true" className="text-emerald-750 shrink-0" size={16} />
                        Contratação após cadastro
                      </li>
                    </ul>
                  </div>
                  <button
                    type="button"
                    className="focus-ring mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-xs font-bold text-white hover:opacity-90 w-full transition-opacity"
                    style={{ backgroundColor: primary }}
                    onClick={handleContract}
                  >
                    Quero contratar
                    <ArrowRight aria-hidden="true" size={15} />
                  </button>
                </article>
              ))
            ) : (
              <article className="rounded-lg border border-stone-200 bg-white p-5 sm:col-span-2">
                <h3 className="text-lg font-bold text-stone-900">Valores sob consulta</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Este treinador prefere apresentar os valores pessoalmente. Entre em contato para saber mais.
                </p>
                {netMessage && <p className="mt-3 text-xs font-bold text-emerald-700">{netMessage}</p>}
                <button
                  type="button"
                  disabled={netLoading}
                  className="focus-ring mt-4 inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: primary }}
                  onClick={() => {
                    if (!user) {
                      navigate(`/login?signup=1&treinador=${team?.slug ?? ""}`);
                      return;
                    }
                    handleStartChat();
                  }}
                >
                  <MessageSquare size={16} />
                  Falar com o Treinador
                </button>
              </article>
            )}
          </div>
        </div>
      </section>

      {/* Locais de atendimento */}
      {((team.worksAt?.length ?? 0) > 0 || team.acceptsHomeVisit || team.acceptsCondoGym) && (
        <section className="mx-auto max-w-6xl px-4 pb-6">
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <MapPin aria-hidden="true" className="text-emerald-800" size={20} />
              <h2 className="text-xl font-black text-stone-900" style={{ fontFamily: "var(--font-display)" }}>Onde atendo</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(team.worksAt ?? []).map((gym) => (
                <span key={gym.id} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                  <Building2 size={13} /> {gym.name}
                </span>
              ))}
              {team.acceptsHomeVisit && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                  <Home size={13} /> Atendimento domiciliar
                </span>
              )}
              {team.acceptsCondoGym && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
                  <Building2 size={13} /> Academia de condomínio
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Horários disponíveis */}
      {team.publicProfile?.showAgenda && (team.availability ?? []).filter(d => d.active).length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-6">
          <div className="rounded-lg border border-stone-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <CalendarDays aria-hidden="true" className="text-emerald-800" size={20} />
              <h2 className="text-xl font-black text-stone-900" style={{ fontFamily: "var(--font-display)" }}>Horários disponíveis</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(team.availability ?? []).filter(d => d.active).map((day) => {
                const labels: Record<string, string> = {
                  segunda: "Segunda", terca: "Terça", quarta: "Quarta",
                  quinta: "Quinta", sexta: "Sexta", sabado: "Sábado", domingo: "Domingo",
                };
                return (
                  <article key={day.weekday} className="rounded-lg border border-stone-200 p-3">
                    <p className="text-sm font-black text-stone-900">{labels[day.weekday] ?? day.weekday}</p>
                    <div className="mt-1.5 space-y-1">
                      {day.morningStartTime && day.morningEndTime && (
                        <p className="flex items-center gap-1 text-xs text-stone-600">
                          <Clock size={11} className="text-emerald-600" />
                          {day.morningStartTime} – {day.morningEndTime}
                        </p>
                      )}
                      {day.afternoonStartTime && day.afternoonEndTime && (
                        <p className="flex items-center gap-1 text-xs text-stone-600">
                          <Clock size={11} className="text-amber-500" />
                          {day.afternoonStartTime} – {day.afternoonEndTime}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Chave PIX — visível apenas para alunos logados */}
      {role === "student" && team.pixKey && (
        <section className="mx-auto max-w-6xl px-4 pb-6">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Pagamento via PIX</p>
                <p className="mt-1 font-black text-stone-900">{team.pixKey}</p>
              </div>
              <button
                type="button"
                className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                onClick={() => {
                  navigator.clipboard.writeText(team.pixKey ?? "").then(() => {
                    setCopiedPix(true);
                    setTimeout(() => setCopiedPix(false), 2000);
                  });
                }}
              >
                {copiedPix ? <CheckCheck size={14} /> : <Copy size={14} />}
                {copiedPix ? "Copiado!" : "Copiar"}
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-stone-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] animate-slide-up">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-stone-900 hidden sm:block">Treine com {team.name}</h3>
            <p className="text-xs text-stone-500 hidden sm:block">A contratação é gratuita. Pague apenas pelas aulas.</p>
          </div>
          
          {isTrainerAndNotMe ? (
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              {netMessage && <p className="text-xs font-bold text-stone-600 mr-2">{netMessage}</p>}
              <button
                type="button"
                onClick={handleRequestJoin}
                disabled={netLoading}
                className="focus-ring flex w-full sm:w-auto items-center justify-center gap-1 rounded-md bg-stone-200 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-300 transition-colors disabled:opacity-50"
              >
                <UserPlus size={16} /> Solicitar Entrada
              </button>
              <button
                type="button"
                onClick={handleInviteToMyTeam}
                disabled={netLoading}
                className="focus-ring flex w-full sm:w-auto items-center justify-center gap-1 rounded-md bg-emerald-100 px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-200 transition-colors disabled:opacity-50"
              >
                <UserCheck size={16} /> Convidar para o meu time
              </button>
              <button
                type="button"
                onClick={handleStartChat}
                disabled={netLoading}
                className="focus-ring flex w-full sm:w-auto items-center justify-center gap-1 rounded-md bg-blue-100 px-4 py-3 text-sm font-bold text-blue-800 hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                <MessageSquare size={16} /> Iniciar Chat
              </button>
            </div>
          ) : !isMyTeam ? (
            <button
              type="button"
              className="focus-ring inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-md px-8 text-base font-black text-white shadow-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: primary }}
              onClick={handleContract}
            >
              Contratar Treinador
              <ArrowRight aria-hidden="true" size={20} />
            </button>
          ) : (
            <p className="text-sm font-bold text-stone-500">Esta é a sua página de treinador.</p>
          )}
        </div>
      </div>
    </div>
  );
}
