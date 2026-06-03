import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import type { UserRole } from "../domain.js";

export interface AuthContext {
  uid: string;
  role?: UserRole;
  teamId?: string;
}

export function requireAuth(request: CallableRequest<unknown>): AuthContext {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login obrigatorio.");
  }

  return {
    uid: request.auth.uid,
    role: request.auth.token.role as UserRole | undefined,
    teamId: request.auth.token.teamId as string | undefined,
  };
}

export function requireRole(context: AuthContext, role: UserRole): void {
  if (context.role !== role) {
    throw new HttpsError("permission-denied", "Papel sem permissao para esta acao.");
  }
}

export function requireTeam(context: AuthContext, teamId: string): void {
  if (context.teamId !== teamId) {
    throw new HttpsError("permission-denied", "Usuario fora do tenant solicitado.");
  }
}
