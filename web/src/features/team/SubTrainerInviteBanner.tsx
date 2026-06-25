import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { Bell, CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import { db } from "../../lib/firebase";
import { useSessionStore } from "../../store/session";
import { usePendingTeamInvites, useLiveCollection, useTrainerChats } from "../../lib/hooks";
import type { TeamMember, TrainerChat } from "../../types/domain";
import { queryClient } from "../../main";

export function SubTrainerInviteBanner() {
  const user = useSessionStore((s) => s.user);
  const role = useSessionStore((s) => s.claims.role);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState("");

  const { data: invites } = usePendingTeamInvites(
    role === "trainer" ? user?.uid : null
  );

  const { data: joinRequests } = useLiveCollection<TeamMember>(
    "teamMembers",
    role === "trainer" && user ? [where("ownerUid", "==", user.uid), where("status", "==", "requesting_join")] : [],
    [],
    [user?.uid, role]
  );

  const { targetChats } = useTrainerChats(role === "trainer" ? user?.uid : null, true);
  const chatRequests = (targetChats || []).filter((c) => c.status === "pending");

  if (!user || role !== "trainer") return null;

  if (invites.length === 0 && joinRequests.length === 0 && chatRequests.length === 0) return null;

  async function handleResponse(invite: TeamMember, accept: boolean) {
    if (!db || respondingId) return;
    const key = invite.id || invite.ownerUid;
    setRespondingId(key);
    setBannerError("");
    try {
      const acceptedAt = new Date().toISOString();
      const q = query(
        collection(db, "teamMembers"),
        where("ownerUid", "==", invite.ownerUid),
        where("subTrainerId", "==", invite.subTrainerId),
        where("status", "==", "pending")
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setBannerError("Convite não encontrado. Pode já ter sido processado.");
        return;
      }
      await Promise.all(snap.docs.map(d => updateDoc(d.ref, {
        status: accept ? "active" : "removed",
        ...(accept ? { acceptedAt } : {}),
      })));

      // Garante que o doc predictable-ID existe e está "active" para as regras do Firestore
      if (accept) {
        const memberId = `${invite.ownerUid}__${invite.subTrainerId}`;
        const predictableRef = doc(db, "teamMembers", memberId);
        const predictableSnap = await getDoc(predictableRef);
        if (!predictableSnap.exists() || predictableSnap.data().status !== "active") {
          const base = snap.docs[0].data();
          await setDoc(predictableRef, {
            ...base,
            id: memberId,
            status: "active",
            acceptedAt,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
      setBannerError("Erro ao processar convite: " + err.message);
    } finally {
      setRespondingId(null);
    }
  }

  async function handleJoinRequestResponse(joinReq: TeamMember, accept: boolean) {
    if (!db || !user) return;
    try {
      const q = query(
        collection(db, "teamMembers"),
        where("ownerUid", "==", joinReq.ownerUid),
        where("subTrainerId", "==", joinReq.subTrainerId),
        where("status", "==", "requesting_join")
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const acceptedAt = new Date().toISOString();
        await updateDoc(snap.docs[0].ref, {
          status: accept ? "active" : "removed",
          ...(accept ? { acceptedAt } : {}),
        });

        if (accept) {
          // Create predictable-ID doc so isActivePartnerOf() Firestore rule works.
          // Rule requires teamMembers/${ownerUid}__${subTrainerId} to exist.
          const memberId = `${joinReq.ownerUid}__${joinReq.subTrainerId}`;
          if (snap.docs[0].id !== memberId) {
            await setDoc(doc(db, "teamMembers", memberId), {
              id: memberId,
              ownerUid: joinReq.ownerUid,
              ownerName: joinReq.ownerName || user.displayName || "",
              subTrainerId: joinReq.subTrainerId,
              subTrainerName: joinReq.subTrainerName || "",
              subTrainerEmail: joinReq.subTrainerEmail || "",
              status: "active",
              invitedAt: joinReq.invitedAt,
              acceptedAt,
            });
          }
        }

        queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
      }
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
    }
  }

  async function handleChatRequestResponse(chatReq: TrainerChat, accept: boolean) {
    if (!db) return;
    try {
      const q = query(
        collection(db, "trainerChats"),
        where("requesterId", "==", chatReq.requesterId),
        where("targetId", "==", chatReq.targetId),
        where("status", "==", "pending")
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, {
          status: accept ? "accepted" : "rejected",
          updatedAt: new Date().toISOString(),
        });
      queryClient.invalidateQueries({ queryKey: ["fetchCollection"] });
      }
    } catch (error: unknown) { const err = error as Error;
      console.error(err);
    }
  }

  return (
    <div className="space-y-2 px-4 pt-3">
      {bannerError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          {bannerError}
        </div>
      )}
      {invites.map((invite) => {
        const key = invite.id || invite.ownerUid;
        const isLoading = respondingId === key;
        return (
        <div
          key={key}
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
              disabled={isLoading}
              onClick={() => handleResponse(invite, true)}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={14} /> {isLoading ? "Aguarde..." : "Aceitar"}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleResponse(invite, false)}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X size={14} /> Recusar
            </button>
          </div>
        </div>
        );
      })}

      {joinRequests.map((joinReq) => (
        <div
          key={joinReq.id || joinReq.subTrainerId}
          className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between animate-slide-up"
        >
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 shrink-0 text-blue-600" size={18} />
            <div>
              <p className="text-sm font-bold text-blue-900">
                <span className="text-blue-700">{joinReq.subTrainerName}</span> solicitou entrada no seu time
              </p>
              <p className="mt-0.5 text-xs text-blue-700">
                Ao aceitar, você poderá delegar aulas para este treinador.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 pl-7 sm:pl-0">
            <button
              type="button"
              onClick={() => handleJoinRequestResponse(joinReq, true)}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-700 px-4 text-xs font-bold text-white hover:bg-blue-600 transition-colors"
            >
              <CheckCircle2 size={14} /> Aceitar
            </button>
            <button
              type="button"
              onClick={() => handleJoinRequestResponse(joinReq, false)}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-4 text-xs font-bold text-blue-700 hover:bg-blue-50 transition-colors"
            >
              <X size={14} /> Recusar
            </button>
          </div>
        </div>
      ))}

      {chatRequests.map((chatReq) => (
        <div
          key={chatReq.id || chatReq.requesterId}
          className="flex flex-col gap-3 rounded-xl border border-purple-200 bg-purple-50 p-4 sm:flex-row sm:items-center sm:justify-between animate-slide-up"
        >
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 shrink-0 text-purple-600" size={18} />
            <div>
              <p className="text-sm font-bold text-purple-900">
                O professor <span className="text-purple-700">{chatReq.requesterName}</span> deseja iniciar um chat com você
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 pl-7 sm:pl-0">
            <button
              type="button"
              onClick={() => handleChatRequestResponse(chatReq, true)}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-purple-700 px-4 text-xs font-bold text-white hover:bg-purple-600 transition-colors"
            >
              <CheckCircle2 size={14} /> Aceitar
            </button>
            <button
              type="button"
              onClick={() => handleChatRequestResponse(chatReq, false)}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-4 text-xs font-bold text-purple-700 hover:bg-purple-50 transition-colors"
            >
              <X size={14} /> Recusar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
