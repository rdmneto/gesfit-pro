import { collection, getDocs, query, updateDoc, where } from "firebase/firestore";
import { Bell, CheckCircle2, X } from "lucide-react";
import { db } from "../../lib/firebase";
import { useSessionStore } from "../../store/session";
import { usePendingTeamInvites } from "../../lib/hooks";
import type { TeamMember } from "../../types/domain";

export function SubTrainerInviteBanner() {
  const user = useSessionStore((s) => s.user);
  const role = useSessionStore((s) => s.claims.role);

  const { data: invites } = usePendingTeamInvites(
    role === "trainer" ? user?.uid : null
  );

  if (!user || role !== "trainer" || invites.length === 0) return null;

  async function handleResponse(invite: TeamMember, accept: boolean) {
    if (!db) return;
    try {
      const q = query(
        collection(db, "teamMembers"),
        where("ownerUid", "==", invite.ownerUid),
        where("subTrainerId", "==", invite.subTrainerId),
        where("status", "==", "pending")
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, {
          status: accept ? "active" : "removed",
          acceptedAt: accept ? new Date().toISOString() : undefined,
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-2 px-4 pt-3">
      {invites.map((invite) => (
        <div
          key={invite.id || invite.ownerUid}
          className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between animate-slide-up"
        >
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 shrink-0 text-amber-600" size={18} />
            <div>
              <p className="text-sm font-bold text-amber-900">
                Convite para integrar o time de{" "}
                <span className="text-amber-700">{invite.ownerName || "um treinador"}</span>
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                Ao aceitar, suas aulas delegadas por este treinador aparecem automaticamente na sua agenda.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 pl-7 sm:pl-0">
            <button
              type="button"
              onClick={() => handleResponse(invite, true)}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-600 transition-colors"
            >
              <CheckCircle2 size={14} /> Aceitar
            </button>
            <button
              type="button"
              onClick={() => handleResponse(invite, false)}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <X size={14} /> Recusar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
