import { useState } from "react";
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
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useSessionStore } from "../../store/session";
import { useTeamMembers, useCollection } from "../../lib/hooks";
import type { TeamMember } from "../../types/domain";

const statusBadge: Record<TeamMember["status"], { label: string; cls: string }> = {
  pending: { label: "Aguardando", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  active: { label: "Ativo", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  removed: { label: "Removido", cls: "bg-stone-100 text-stone-600 border-stone-200" },
};

export function TeamManagementPanel() {
  const user = useSessionStore((s) => s.user);
  const { data: members, loading } = useTeamMembers(user?.uid);

  // Also load pending invites sent by this owner
  const { data: pendingMembers } = useCollection<TeamMember>(
    "teamMembers",
    user ? [where("ownerUid", "==", user.uid), where("status", "==", "pending")] : [],
    [],
    [user?.uid]
  );

  const allMembers = [
    ...members,
    ...pendingMembers.filter((p) => !members.some((m) => m.id === p.id)),
  ];

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !user || !inviteEmail.trim()) return;

    setInviteLoading(true);
    setInviteError("");
    setInviteSuccess("");

    try {
      // Search for the trainer by email in /users collection
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", inviteEmail.trim().toLowerCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        setInviteError("Nenhum treinador encontrado com este e-mail. Verifique se ele já tem cadastro no Gesfit.");
        return;
      }

      const subDoc = snap.docs[0];
      const subData = subDoc.data();

      if (subDoc.id === user.uid) {
        setInviteError("Você não pode convidar a si mesmo.");
        return;
      }

      if (subData.role !== "trainer") {
        setInviteError("Este usuário não é um treinador.");
        return;
      }

      // Check if already a member
      const existingQ = query(
        collection(db, "teamMembers"),
        where("ownerUid", "==", user.uid),
        where("subTrainerId", "==", subDoc.id)
      );
      const existingSnap = await getDocs(existingQ);
      if (!existingSnap.empty) {
        const existing = existingSnap.docs[0].data();
        if (existing.status !== "removed") {
          setInviteError("Este treinador já faz parte do seu time ou tem convite pendente.");
          return;
        }
      }

      const memberId = `${user.uid}__${subDoc.id}`;
      await addDoc(collection(db, "teamMembers"), {
        id: memberId,
        ownerUid: user.uid,
        ownerName: user.displayName || "",
        subTrainerId: subDoc.id,
        subTrainerName: subData.displayName || subData.name || "Treinador",
        subTrainerEmail: inviteEmail.trim().toLowerCase(),
        status: "pending",
        invitedAt: new Date().toISOString(),
      });

      setInviteSuccess(`Convite enviado para ${subData.displayName || inviteEmail}! Ele verá o convite ao entrar no app.`);
      setInviteEmail("");
    } catch (err: any) {
      console.error(err);
      setInviteError("Erro ao enviar convite: " + err.message);
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRemove(member: TeamMember) {
    if (!db) return;
    if (!confirm(`Remover ${member.subTrainerName} do time? Aulas futuras atribuídas a ele não serão canceladas automaticamente.`)) return;
    try {
      // Find the doc by querying (we don't store the docId directly)
      const q = query(
        collection(db, "teamMembers"),
        where("ownerUid", "==", member.ownerUid),
        where("subTrainerId", "==", member.subTrainerId)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, { status: "removed" });
      }
    } catch (err: any) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="card p-5">
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

        {/* Invite Form */}
        <form onSubmit={handleInvite} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
              E-mail do treinador
            </span>
            <div className="relative mt-1.5">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="treinador@email.com"
                className="focus-ring h-11 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm"
              />
            </div>
          </label>
          <button
            type="submit"
            disabled={inviteLoading || !inviteEmail.trim()}
            className="focus-ring inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors shrink-0"
          >
            {inviteLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <UserPlus size={16} />
            )}
            Enviar convite
          </button>
        </form>

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
      <section className="card p-5">
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
            {allMembers.map((member) => {
              const badge = statusBadge[member.status];
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
    </div>
  );
}
