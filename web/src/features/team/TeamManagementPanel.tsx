import { cardClasses } from "../../components/ui/Primitives";
import { cn } from "../../lib/utils";
import { useState, useMemo, useEffect } from "react";
import {
  CheckCircle2,
  Clock,
  Mail,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useSessionStore } from "../../store/session";
import { useTeamMembers, useLiveCollection } from "../../lib/hooks";
import type { TeamMember } from "../../types/domain";
import { queryClient } from "../../main";

const statusBadge: Record<TeamMember["status"], { label: string; cls: string }> = {
  pending: { label: "Aguardando", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  requesting_join: { label: "Solicitando", cls: "bg-blue-50 text-blue-800 border-blue-200" },
  active: { label: "Ativo", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  removed: { label: "Removido", cls: "bg-stone-100 text-stone-600 border-stone-200" },
};

export function TeamManagementPanel() {
  const user = useSessionStore((s) => s.user);
  const { data: members, loading } = useTeamMembers(user?.uid);

  // Also load pending invites sent by this owner
  const { data: pendingMembers } = useLiveCollection<TeamMember>(
    "teamMembers",
    user ? [where("ownerUid", "==", user.uid), where("status", "==", "pending")] : [],
    [],
    [user?.uid]
  );

  // Teams where the current user is a sub-trainer
  const { data: teamsIPlayIn } = useLiveCollection<TeamMember>(
    "teamMembers",
    user ? [where("subTrainerId", "==", user.uid), where("status", "==", "active")] : [],
    [],
    [user?.uid]
  );

  const allMembers = [
    ...members,
    ...pendingMembers.filter((p) => !members.some((m) => m.id === p.id)),
  ];

  // Ensure every active member has a predictable-ID doc so isActivePartnerOf() rule works.
  // Old invites created with addDoc have auto-generated IDs; the rule requires
  // teamMembers/${ownerUid}__${subTrainerId} to exist with status=="active".
  useEffect(() => {
    if (!db || !user?.uid || !members.length) return;
    members.forEach(async (member) => {
      const predictableId = `${user.uid}__${member.subTrainerId}`;
      if (member.id === predictableId) return;
      try {
        const ref = doc(db!, "teamMembers", predictableId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            id: predictableId,
            ownerUid: user.uid,
            ownerName: user.displayName || "",
            subTrainerId: member.subTrainerId,
            subTrainerName: member.subTrainerName || "",
            subTrainerEmail: member.subTrainerEmail || "",
            status: "active",
            invitedAt: member.invitedAt,
            acceptedAt: member.acceptedAt || new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error("Failed to create predictable teamMember doc:", e);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.map(m => m.id).join(","), user?.uid]);

  // Fetch trainers for search
  const { data: allTrainers } = useLiveCollection<{ id: string; name?: string; email?: string }>(
    "users",
    [where("role", "==", "trainer")],
    []
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [inviteLoadingId, setInviteLoadingId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return allTrainers
      .filter((t) => t.id !== user?.uid && (t.name?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q)))
      .slice(0, 5);
  }, [allTrainers, searchQuery, user?.uid]);

  async function handleInviteTrainer(subTrainerId: string, subTrainerName: string, subTrainerEmail: string) {
    if (!db || !user) return;

    setInviteLoadingId(subTrainerId);
    setInviteError("");
    setInviteSuccess("");

    try {
      // Check if already a member
      const existingQ = query(
        collection(db, "teamMembers"),
        where("ownerUid", "==", user.uid),
        where("subTrainerId", "==", subTrainerId)
      );
      const existingSnap = await getDocs(existingQ);
      if (!existingSnap.empty) {
        const anyActive = existingSnap.docs.some(d => d.data().status !== "removed");
        if (anyActive) {
          setInviteError(`O treinador ${subTrainerName} já faz parte do seu time ou tem convite pendente.`);
          return;
        }
      }

      const memberId = `${user.uid}__${subTrainerId}`;
      await setDoc(doc(db, "teamMembers", memberId), {
        id: memberId,
        ownerUid: user.uid,
        ownerName: user.displayName || "",
        subTrainerId: subTrainerId,
        subTrainerName: subTrainerName || "Treinador",
        subTrainerEmail: subTrainerEmail,
        status: "pending",
        invitedAt: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });

      setInviteSuccess(`Convite enviado para ${subTrainerName}! Ele verá o convite ao entrar no app.`);
      setSearchQuery("");
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setInviteError("Erro ao enviar convite: " + err.message);
    } finally {
      setInviteLoadingId(null);
    }
  }


  async function handleRemove(member: TeamMember) {
    if (!db) return;
    if (!confirm(`Tem certeza que deseja remover ${member.subTrainerName} do seu time? As aulas futuras dele serão desatribuídas e entrarão em lista de pendências.`)) return;
    try {
      const batch = writeBatch(db);

      // 1. Marca TODOS os docs do parceiro como removidos (pode existir auto-ID + predictable-ID)
      const tmQ = query(
        collection(db, "teamMembers"),
        where("ownerUid", "==", member.ownerUid),
        where("subTrainerId", "==", member.subTrainerId)
      );
      const tmSnap = await getDocs(tmQ);
      tmSnap.docs.forEach(d => batch.update(d.ref, { status: "removed" }));

      // 2. Desatribui aulas futuras do parceiro e marca como pendentes
      const now = new Date().toISOString();
      const sessQ = query(
        collection(db, "workoutSessions"),
        where("trainerId", "==", member.ownerUid),
        where("assignedToId", "==", member.subTrainerId)
      );
      const sessSnap = await getDocs(sessQ);
      sessSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.startsAt > now && data.status === "scheduled") {
          batch.update(doc(db!, "workoutSessions", d.id), {
            assignedToId: null,
            assignedToName: null,
            pendingReview: true,
          });
        }
      });

      await batch.commit();
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
    }
  }

  async function handleLeave(member: TeamMember) {
    if (!db) return;
    if (!confirm(`Tem certeza que deseja sair do time de ${member.ownerName}? Aulas futuras atribuídas a você deixarão de aparecer em sua agenda.`)) return;
    try {
      const q = query(
        collection(db, "teamMembers"),
        where("ownerUid", "==", member.ownerUid),
        where("subTrainerId", "==", member.subTrainerId)
      );
      const snap = await getDocs(q);
      // Update ALL matching docs (auto-ID + predictable-ID may both exist)
      await Promise.all(snap.docs.map(d => updateDoc(d.ref, { status: "removed" })));

      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className={cn(cardClasses, "p-5")}>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
            <Users aria-hidden="true" className="text-emerald-700" size={16} />
          </div>
          <h2 className="text-lg font-black text-stone-950">Meu Time</h2>
        </div>
        <p className="mt-1 text-xs text-stone-400">
          Convide outros treinadores cadastrados para integrar seu time. Você poderá delegar aulas
          a eles mantendo o controle total do vínculo e créditos dos alunos.
        </p>

        {/* Invite Search */}
        <div className="mt-5 relative">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
              Buscar treinador
            </span>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nome ou e-mail do treinador"
                className="focus-ring h-11 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm"
              />
            </div>
          </label>
          
          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden divide-y divide-stone-100">
              {searchResults.map(trainer => (
                <div key={trainer.id} className="flex items-center justify-between p-3 hover:bg-stone-50 transition-colors">
                  <div>
                    <p className="font-bold text-sm text-stone-900">{trainer.name || "Treinador"}</p>
                    <p className="text-xs text-stone-500">{trainer.email}</p>
                  </div>
                  <button
                    onClick={() => handleInviteTrainer(trainer.id, trainer.name || "", trainer.email || "")}
                    disabled={inviteLoadingId === trainer.id}
                    className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-100 text-emerald-800 px-3 text-xs font-bold hover:bg-emerald-200 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {inviteLoadingId === trainer.id ? "Aguarde..." : <><UserPlus size={14} /> Convidar</>}
                  </button>
                </div>
              ))}
            </div>
          )}
          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-lg border border-stone-200 p-4 text-center text-sm text-stone-500">
              Nenhum treinador encontrado.
            </div>
          )}
        </div>

        {inviteError && (
          <p className="mt-3 flex items-center gap-2 text-sm text-rose-600">
            <XCircle size={15} /> {inviteError}
          </p>
        )}
        {inviteSuccess && (
          <p className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 size={15} /> {inviteSuccess}
          </p>
        )}
      </section>

      {/* Members List */}
      <section className={cn(cardClasses, "p-5")}>
        <div className="flex items-center gap-2">
          <Shield aria-hidden="true" className="text-emerald-800" size={20} />
          <h2 className="text-lg font-black text-stone-950">Membros do Time</h2>
        </div>

        {loading ? (
          <div className="mt-6 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />
          </div>
        ) : allMembers.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-stone-200 bg-stone-50 py-12 text-center">
            <Users className="mx-auto mb-3 text-stone-300" size={36} />
            <p className="font-semibold text-stone-500">Nenhum membro ainda</p>
            <p className="mt-1 text-sm text-stone-400">
              Convide treinadores pelo e-mail acima para montar seu time.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-stone-100">
            {allMembers.map((member: TeamMember) => {
              const badge = statusBadge[member.status as keyof typeof statusBadge];
              return (
                <div
                  key={member.id || member.subTrainerId}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                      <UserCheck size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-stone-900">{member.subTrainerName}</p>
                      <p className="text-xs text-stone-500">{member.subTrainerEmail}</p>
                      {member.status === "pending" && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-600">
                          <Clock size={11} /> Convite enviado — aguardando aceite
                        </p>
                      )}
                      {member.status === "active" && member.acceptedAt && (
                        <p className="mt-0.5 text-xs text-stone-400">
                          Membro desde {new Date(member.acceptedAt).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    {member.status !== "removed" && (
                      <button
                        type="button"
                        onClick={() => handleRemove(member)}
                        className="focus-ring rounded-lg p-1.5 text-stone-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        aria-label={`Remover ${member.subTrainerName}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Times que participo */}
      {teamsIPlayIn && teamsIPlayIn.length > 0 && (
        <section className={cn(cardClasses, "p-5")}>
          <div className="flex items-center gap-2">
            <UserCheck aria-hidden="true" className="text-emerald-800" size={20} />
            <h2 className="text-lg font-black text-stone-950">Times que participo</h2>
          </div>
          <div className="mt-4 divide-y divide-stone-100">
            {teamsIPlayIn.map((member) => (
              <div
                key={`member-of-${member.ownerUid}`}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                    <Shield size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-stone-900">Time de {member.ownerName}</p>
                    {member.acceptedAt && (
                      <p className="mt-0.5 text-xs text-stone-400">
                        Membro desde {new Date(member.acceptedAt).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleLeave(member)}
                  className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 px-3 text-xs font-bold text-stone-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                >
                  <XCircle size={14} /> Sair do time
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
