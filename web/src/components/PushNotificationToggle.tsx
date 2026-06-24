import React, { useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { Card, CardHeader } from "./ui/Primitives";
import { Bell, BellOff, BellRing } from "lucide-react";
import { messaging, db } from "../lib/firebase";
import { getToken } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { useSessionStore } from "../store/session";

export const PushNotificationToggle: React.FC = () => {
  const { user } = useSessionStore();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      setError("Seu navegador não suporta notificações web.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted" && messaging && user) {
        // Obter FCM Token
        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        const currentToken = await getToken(messaging, { vapidKey });
        
        if (currentToken) {
          // Salvar token no perfil do usuário no Firestore
          const userRef = doc(db!, "users", user.uid);
          await updateDoc(userRef, {
            fcmTokens: arrayUnion(currentToken)
          });
          console.log("Push notification token salvo com sucesso.");
        } else {
          setError("Não foi possível gerar o token de notificação.");
        }
      } else if (result === "denied") {
        setError("Você bloqueou as notificações. Altere nas configurações do navegador.");
      }
    } catch (err: any) {
      console.error("Erro ao ativar notificações:", err);
      setError(err.message || "Ocorreu um erro ao tentar ativar as notificações.");
    } finally {
      setLoading(false);
    }
  };

  if (!("Notification" in window)) {
    return null;
  }

  return (
    <Card className="border-emerald-100 bg-emerald-50/30 p-5">
      <CardHeader 
        icon={permission === "granted" ? BellRing : permission === "denied" ? BellOff : Bell} 
        title="Notificações Push" 
      />
      <div className="mt-3">
        <p className="text-sm text-stone-500 mb-4">
          Receba lembretes de aulas e mensagens do chat diretamente na tela do seu celular ou computador.
        </p>

        {permission === "granted" ? (
          <div className="flex items-center text-sm text-emerald-700 font-medium">
            Notificações estão ativadas neste dispositivo!
          </div>
        ) : permission === "denied" ? (
          <div className="text-sm text-red-600">
            Você bloqueou as notificações para este site. Para receber alertas, permita nas configurações do navegador e recarregue a página.
          </div>
        ) : (
          <div className="space-y-3">
            <Button 
              onClick={requestPermission} 
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? "Ativando..." : "Ativar Notificações"}
            </Button>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        )}
      </div>
    </Card>
  );
};
