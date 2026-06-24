import { CalendarDays, Search, Tag, MessageSquare, UserPlus, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { moneyFromCents } from "../lib/format";
import { useCollection, useClassProducts } from "../lib/hooks";
import type { Team } from "../types/domain";
import { collection, getDocs, query, where, setDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useSessionStore } from "../store/session";

export function TeamsPage() {
  const { data: dbTeams, loading } = useCollection<Team>("teams", [where("publicListing", "==", true)], [], []);

  const [query, setQuery] = useState("");

  const allTeams = useMemo(() => dbTeams ?? [], [dbTeams]);

  const teams = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return allTeams;
    }

    return allTeams.filter((team) => {
      return [team.name, team.branding?.bio || ""].some((value) =>
        value.toLowerCase().includes(normalized),
      );
    });
  }, [allTeams, query]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
          <p className="text-sm text-stone-400">Carregando treinadores...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black text-stone-950" style={{ fontFamily: "var(--font-display)" }}>Treinadores e times</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
            Lista pública para alunos visualizarem agenda, aulas avulsas e pacotes antes do
            cadastro.
          </p>
        </div>
        <label className="relative block sm:w-80">
          <span className="sr-only">Buscar time</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500"
            size={18}
          />
          <input
            className="focus-ring h-11 w-full rounded-md border border-stone-300 bg-white pl-10 pr-3 text-sm text-stone-900"
            placeholder="Buscar"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {teams.length === 0 ? (
          <p className="col-span-full py-12 text-center text-stone-400">
            Nenhum treinador encontrado.
          </p>
        ) : (
          teams.map((team) => (
            <TrainerListItem key={team.id} team={team} />
          ))
        )}
      </div>
    </section>
  );
}

function TrainerListItem({ team }: { team: Team }) {
  const { data: dbProducts } = useClassProducts(team.id);
  const user = useSessionStore((s) => s.user);
  const role = useSessionStore((s) => s.claims.role);

  const products = useMemo(
    () => (dbProducts || []).filter((p) => p.active && p.publicVisible),
    [dbProducts],
  );

  const single = useMemo(() => products.find((product) => product.type === "single"), [products]);
  const packages = useMemo(() => products.filter((product) => product.type === "package"), [products]);

  const isTrainerAndNotMe = role === "trainer" && user?.uid !== team.ownerUid;

  return (
    <div className="focus-ring overflow-hidden rounded-lg border border-stone-200 bg-white hover:border-emerald-700 transition-all hover:shadow-[var(--shadow-md)] flex flex-col">
      <Link to={`/t/${team.slug}`} className="flex-1">
        <img 
          className="h-44 w-full object-cover" 
          src={team.branding?.bannerPhotoURL || team.branding?.heroPhotoURL || "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=1600&q=80"} 
          alt={`Banner de ${team.name}`} 
        />
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: team.branding?.primaryColor || "var(--color-primary)" }}
            />
            <h2 className="text-xl font-bold text-stone-950">{team.name}</h2>
          </div>
          <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700">
            {team.isSolo ? "Treinador solo" : "Equipe"}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-stone-500 line-clamp-2">{team.branding?.bio || "Sem biografia cadastrada."}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Summary
            icon={Tag}
            label="Aula avulsa"
            value={single ? moneyFromCents(single.priceCents) : "Sob consulta"}
          />
          <Summary
            icon={CalendarDays}
            label="Horários visíveis"
            value="Disponível"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {packages.slice(0, 3).map((product) => (
            <span
              key={product.id}
              className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-900"
            >
              {product.classesCount} aulas por {moneyFromCents(product.priceCents)}
            </span>
          ))}
        </div>
      </div>
      </Link>
      {isTrainerAndNotMe && (
        <div className="p-4 bg-stone-50 border-t border-stone-200 mt-auto">
          <TrainerNetworkingActions team={team} currentUser={user} />
        </div>
      )}
    </div>
  );
}

function TrainerNetworkingActions({ team, currentUser }: { team: Team; currentUser: { uid: string; displayName?: string | null; email?: string | null } | null }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRequestJoin() {
    if (!db || !currentUser) return;
    setLoading(true);
    setMessage("");
    try {
      const existingQ = query(
        collection(db, "teamMembers"),
        where("ownerUid", "==", team.ownerUid),
        where("subTrainerId", "==", currentUser.uid)
      );
      const snap = await getDocs(existingQ);
      if (!snap.empty) {
        setMessage("Vínculo ou convite já existente.");
        setLoading(false);
        return;
      }
      const memberId = `${team.ownerUid}__${currentUser.uid}`;
      await setDoc(doc(db, "teamMembers", memberId), {
        id: memberId,
        ownerUid: team.ownerUid,
        ownerName: team.name,
        subTrainerId: currentUser.uid,
        subTrainerName: currentUser.displayName || "Treinador",
        subTrainerEmail: currentUser.email,
        status: "requesting_join",
        invitedAt: new Date().toISOString(),
      });
      setMessage("Solicitação enviada!");
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setMessage("Erro: " + err.message);
    }
    setLoading(false);
  }

  async function handleInviteToMyTeam() {
    if (!db || !currentUser) return;
    setLoading(true);
    setMessage("");
    try {
      const existingQ = query(
        collection(db, "teamMembers"),
        where("ownerUid", "==", currentUser.uid),
        where("subTrainerId", "==", team.ownerUid)
      );
      const snap = await getDocs(existingQ);
      if (!snap.empty) {
        setMessage("Vínculo ou convite já existente.");
        setLoading(false);
        return;
      }
      const memberId = `${currentUser.uid}__${team.ownerUid}`;
      await setDoc(doc(db, "teamMembers", memberId), {
        id: memberId,
        ownerUid: currentUser.uid,
        ownerName: currentUser.displayName || "",
        subTrainerId: team.ownerUid,
        subTrainerName: team.name,
        subTrainerEmail: "", // We might not know it, but that's okay for display purposes
        status: "pending",
        invitedAt: new Date().toISOString(),
      });
      setMessage("Convite enviado!");
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setMessage("Erro: " + err.message);
    }
    setLoading(false);
  }

  async function handleStartChat() {
    if (!db || !currentUser) return;
    setLoading(true);
    setMessage("");
    try {
      // Check if chat request already exists (we might need a smarter check, but for now we just try)
      // Actually we don't have a good query to check both directions easily, so we just blindly create or assume it's fine.
      // But we can construct the predictable ID!
      const ids = [currentUser.uid, team.ownerUid].sort();
      const chatId = `${ids[0]}__${ids[1]}`;
      
      await setDoc(doc(db, "trainerChats", chatId), {
        id: chatId, 
        requesterId: currentUser.uid,
        requesterName: currentUser.displayName || "Treinador",
        targetId: team.ownerUid,
        targetName: team.name,
        status: "accepted",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setMessage("");
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
      setMessage("Erro: " + err.message);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleRequestJoin}
          disabled={loading}
          className="focus-ring flex items-center gap-1 rounded-md bg-stone-200 px-2 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-300 transition-colors disabled:opacity-50"
          title="Solicitar entrada para o time deste personal"
        >
          <UserPlus size={14} /> Solicitar Entrada
        </button>
        <button
          onClick={handleInviteToMyTeam}
          disabled={loading}
          className="focus-ring flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-200 transition-colors disabled:opacity-50"
          title="Convidar este personal para ingressar no seu time"
        >
          <UserCheck size={14} /> Convidar para o meu time
        </button>
        <button
          onClick={handleStartChat}
          disabled={loading}
          className="focus-ring flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-200 transition-colors disabled:opacity-50"
          title="Iniciar um chat com este personal"
        >
          <MessageSquare size={14} /> Iniciar Chat
        </button>
      </div>
      {message && <p className="text-xs text-stone-500 mt-1">{message}</p>}
    </div>
  );
}

function Summary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-stone-100 px-3 py-2">
      <Icon aria-hidden="true" className="text-emerald-800" size={17} />
      <div>
        <p className="text-xs text-stone-500">{label}</p>
        <p className="text-sm font-bold text-stone-800">{value}</p>
      </div>
    </div>
  );
}
