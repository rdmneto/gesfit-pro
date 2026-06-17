import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, XCircle, UserCircle, BellRing, Ban } from "lucide-react";
import { useSessionStore } from "../../store/session";
import { useStudentEnrollments, useTrainerEnrollments, useTrainerChats } from "../../lib/hooks";
import { db } from "../../lib/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { ChatWindow } from "./ChatWindow";
import type { Enrollment, TrainerChat } from "../../types/domain";

export function GlobalChat() {
  const user = useSessionStore((s) => s.user);
  const role = useSessionStore((s) => s.claims.role);

  const [isOpen, setIsOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeChatType, setActiveChatType] = useState<"enrollment" | "trainerChat" | null>(null);
  const [activeOtherUserId, setActiveOtherUserId] = useState<string>("");
  const [activeOtherUserName, setActiveOtherUserName] = useState<string>("");
  const [activeOtherUserPhoto, setActiveOtherUserPhoto] = useState<string | undefined>(undefined);

  // Fetch enrollments
  const { data: studentEnrollments = [] } = useStudentEnrollments(role === "student" ? user?.uid : null);
  const { data: trainerEnrollments = [] } = useTrainerEnrollments(role === "trainer" ? user?.uid : null);
  
  // Fetch trainer chats
  const { requestedChats = [], targetChats = [] } = useTrainerChats(role === "trainer" ? user?.uid : null);

  // Combine and format all chats
  const allChats = useMemo(() => {
    if (!user) return [];
    
    const chats: Array<{
      id: string;
      type: "enrollment" | "trainerChat";
      otherUserId: string;
      otherUserName: string;
      lastMessageAt: string;
      lastMessageText: string;
      isUnread: boolean;
      blockedBy: string[];
      role: "student" | "trainer";
    }> = [];

    if (role === "student") {
      studentEnrollments.forEach((e) => {
        if (e.status !== "cancelled") {
          chats.push({
            id: e.id,
            type: "enrollment",
            otherUserId: e.trainerId,
            otherUserName: e.teamName || "Treinador",
            lastMessageAt: e.lastMessageAt || e.createdAt,
            lastMessageText: e.lastMessageText || "",
            isUnread: e.unreadBy?.includes(user.uid) || false,
            blockedBy: e.blockedBy || [],
            role: "student"
          });
        }
      });
    } else if (role === "trainer") {
      trainerEnrollments.forEach((e) => {
        if (e.status !== "cancelled") {
          chats.push({
            id: e.id,
            type: "enrollment",
            otherUserId: e.studentId,
            otherUserName: e.studentName || "Aluno",
            lastMessageAt: e.lastMessageAt || e.createdAt,
            lastMessageText: e.lastMessageText || "",
            isUnread: e.unreadBy?.includes(user.uid) || false,
            blockedBy: e.blockedBy || [],
            role: "trainer"
          });
        }
      });

      const activeTrainerChats = [...requestedChats, ...targetChats].filter(c => c.status === "accepted");
      activeTrainerChats.forEach((c) => {
        const isRequester = c.requesterId === user.uid;
        chats.push({
          id: c.id,
          type: "trainerChat",
          otherUserId: isRequester ? c.targetId : c.requesterId,
          otherUserName: isRequester ? c.targetName : c.requesterName,
          lastMessageAt: c.lastMessageAt || c.updatedAt || c.createdAt,
          lastMessageText: c.lastMessageText || "",
          isUnread: c.unreadBy?.includes(user.uid) || false,
          blockedBy: c.blockedBy || [],
          role: "trainer"
        });
      });
    }

    // Sort by lastMessageAt descending
    return chats.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }, [user, role, studentEnrollments, trainerEnrollments, requestedChats, targetChats]);

  const totalUnread = allChats.filter(c => c.isUnread).length;

  if (!user || !role) return null;

  function openChat(chat: typeof allChats[0]) {
    setActiveChatId(chat.id);
    setActiveChatType(chat.type);
    setActiveOtherUserId(chat.otherUserId);
    setActiveOtherUserName(chat.otherUserName);
    setActiveOtherUserPhoto(undefined); // Could pass from somewhere if we have it
    setIsOpen(false);
  }

  useEffect(() => {
    function handleOpenGlobalChat(e: Event) {
      const customEvent = e as CustomEvent;
      const { chatId, type, otherUserId, otherUserName } = customEvent.detail;
      setActiveChatId(chatId);
      setActiveChatType(type);
      setActiveOtherUserId(otherUserId);
      setActiveOtherUserName(otherUserName);
      setIsOpen(false);
    }
    window.addEventListener("openGlobalChat", handleOpenGlobalChat);
    return () => window.removeEventListener("openGlobalChat", handleOpenGlobalChat);
  }, []);

  const activeChat = allChats.find(c => c.id === activeChatId);
  const isBlockedByMe = activeChat?.blockedBy?.includes(user?.uid || "") || false;
  const amIBlocked = activeChat?.blockedBy?.includes(activeOtherUserId) || false;

  async function toggleBlock() {
    if (!activeChatId || !user || !db) return;
    const parentRef = doc(db, activeChatType === "enrollment" ? "enrollments" : "trainerChats", activeChatId);
    if (isBlockedByMe) {
      await updateDoc(parentRef, { blockedBy: arrayRemove(user.uid) });
    } else {
      await updateDoc(parentRef, { blockedBy: arrayUnion(user.uid) });
    }
  }

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="focus-ring relative flex h-10 w-10 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
          aria-label="Mensagens"
        >
          <MessageSquare size={20} />
          {totalUnread > 0 && (
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[var(--color-surface)]" />
          )}
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setIsOpen(false)} />
            <div className="absolute right-0 top-12 z-50 w-screen max-w-sm overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl sm:w-80 animate-fade-in origin-top-right">
              <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-3">
                <h3 className="font-bold text-stone-900">Mensagens</h3>
                {totalUnread > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                    {totalUnread} nova{totalUnread !== 1 && "s"}
                  </span>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {allChats.length === 0 ? (
                  <div className="p-6 text-center text-sm text-stone-500">
                    Nenhuma conversa ativa no momento.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-50">
                    {allChats.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => openChat(chat)}
                        className={`focus-ring flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-stone-50 ${chat.isUnread ? "bg-stone-50" : ""}`}
                      >
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                          <UserCircle size={24} />
                          {chat.isUnread && (
                            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-white" />
                          )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="flex justify-between items-center mb-0.5">
                            <p className={`truncate text-sm ${chat.isUnread ? "font-bold text-stone-900" : "font-semibold text-stone-700"}`}>
                              {chat.otherUserName}
                            </p>
                            <span className="text-[10px] text-stone-400 shrink-0 ml-2">
                              {new Date(chat.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className={`truncate text-xs ${chat.isUnread ? "text-stone-700 font-medium" : "text-stone-500"}`}>
                            {chat.lastMessageText || "Nova conversa iniciada"}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating Chat Window */}
      {activeChatId && activeChatType && createPortal(
        <div className="fixed bottom-0 right-0 z-[9999] w-full sm:w-[400px] sm:pr-4 sm:pb-4 pointer-events-none">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl h-[80vh] sm:h-[600px] flex flex-col overflow-hidden shadow-2xl border border-stone-200 pointer-events-auto animate-slide-up">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-stone-200 bg-stone-50 shrink-0">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                  <UserCircle size={20} />
                </div>
                <div className="overflow-hidden">
                  <h2 className="font-bold text-sm text-stone-900 truncate leading-tight">
                    {activeOtherUserName}
                  </h2>
                  <p className="text-[10px] text-stone-500 truncate">
                    {activeChatType === "enrollment" && role === "student" ? "Treinador" : 
                     activeChatType === "enrollment" && role === "trainer" ? "Aluno" : "Treinador"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {activeChatType === "trainerChat" && (
                  <button 
                    onClick={toggleBlock}
                    title={isBlockedByMe ? "Desbloquear" : "Bloquear"}
                    className={`p-1.5 rounded-full transition-colors shrink-0 ${
                      isBlockedByMe 
                        ? "text-red-600 bg-red-100 hover:bg-red-200" 
                        : "text-stone-400 hover:bg-stone-200 hover:text-stone-600"
                    }`}
                  >
                    <Ban size={18} />
                  </button>
                )}
                <button 
                  onClick={() => setActiveChatId(null)}
                  className="p-1.5 rounded-full hover:bg-stone-200 text-stone-500 transition-colors shrink-0"
                >
                  <XCircle size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatWindow 
                chatId={activeChatId}
                chatType={activeChatType}
                currentUserId={user.uid}
                currentUserRole={role === "student" ? "student" : "trainer"}
                otherUserId={activeOtherUserId}
                otherUserName={activeOtherUserName}
                otherUserPhoto={activeOtherUserPhoto}
                isBlockedByMe={isBlockedByMe}
                amIBlocked={amIBlocked}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
