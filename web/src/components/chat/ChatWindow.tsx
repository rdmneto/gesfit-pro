import { useEffect, useState, useRef } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, arrayRemove } from "firebase/firestore";
import { Send, UserCircle } from "lucide-react";
import { db } from "../../lib/firebase";
import type { ChatMessage } from "../../types/domain";

interface ChatWindowProps {
  chatId: string;
  chatType: "enrollment" | "trainerChat";
  currentUserId: string;
  currentUserRole: "student" | "trainer";
  otherUserId: string;
  otherUserName: string;
  otherUserPhoto?: string;
  isBlockedByMe?: boolean;
  amIBlocked?: boolean;
}

export function ChatWindow({ chatId, chatType, currentUserId, currentUserRole, otherUserId, otherUserName, otherUserPhoto, isBlockedByMe, amIBlocked }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!db) return;

    const collectionName = chatType === "enrollment" ? "enrollments" : "trainerChats";
    const messagesRef = collection(db, collectionName, chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(loadedMessages);
      // Auto scroll to bottom
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });

    // Mark as read when opening
    const parentRef = doc(db, collectionName, chatId);
    updateDoc(parentRef, {
      unreadBy: arrayRemove(currentUserId)
    }).catch(err => console.error("Failed to clear unread:", err));

    return () => unsubscribe();
  }, [chatId, chatType]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !db) return;

    const text = newMessage;
    setNewMessage("");

    const collectionName = chatType === "enrollment" ? "enrollments" : "trainerChats";
    const messagesRef = collection(db, collectionName, chatId, "messages");
    const now = new Date().toISOString();
    await addDoc(messagesRef, {
      text,
      senderId: currentUserId,
      senderRole: currentUserRole,
      createdAt: now, 
      read: false
    });

    const parentRef = doc(db, collectionName, chatId);
    await updateDoc(parentRef, {
      lastMessageAt: now,
      lastMessageText: text,
      unreadBy: [otherUserId]
    });
  }

  return (
    <div className="flex flex-col h-full bg-stone-50 border border-stone-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 bg-white p-4 border-b border-stone-200">
        {otherUserPhoto ? (
          <img src={otherUserPhoto} alt={otherUserName} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <UserCircle size={24} />
          </div>
        )}
        <div>
          <h3 className="font-bold text-stone-900 leading-tight">{otherUserName}</h3>
          <p className="text-xs text-stone-500">{currentUserRole === "student" ? "Treinador" : "Aluno"}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center px-4">
            <p className="text-sm text-stone-500">
              Inicie a conversa com {otherUserName}. As mensagens aparecerão aqui.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div 
                  className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                    isMe 
                      ? "bg-emerald-600 text-white rounded-br-sm" 
                      : "bg-white border border-stone-200 text-stone-900 rounded-bl-sm"
                  }`}
                >
                  <p className="text-sm">{msg.text}</p>
                  <span className={`text-[10px] mt-1 block ${isMe ? "text-emerald-200" : "text-stone-400"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-stone-200">
        {isBlockedByMe ? (
          <div className="h-11 flex items-center justify-center text-sm text-stone-500 bg-stone-100 rounded-full border border-stone-200">
            Você bloqueou este contato.
          </div>
        ) : amIBlocked ? (
          <div className="h-11 flex items-center justify-center text-sm text-stone-500 bg-stone-100 rounded-full border border-stone-200">
            Você não pode enviar mensagens para este contato.
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite uma mensagem..."
              className="flex-1 h-11 px-4 border border-stone-300 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="h-11 w-11 flex items-center justify-center rounded-full bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition-colors"
            >
              <Send size={18} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
