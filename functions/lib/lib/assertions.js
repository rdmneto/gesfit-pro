import { HttpsError } from "firebase-functions/v2/https";
export function requireAuth(request) {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Login obrigatorio.");
    }
    return {
        uid: request.auth.uid,
        role: request.auth.token.role,
        teamId: request.auth.token.teamId,
    };
}
export function requireRole(context, role) {
    if (context.role !== role) {
        throw new HttpsError("permission-denied", "Papel sem permissao para esta acao.");
    }
}
export function requireTeam(context, teamId) {
    if (context.teamId !== teamId) {
        throw new HttpsError("permission-denied", "Usuario fora do tenant solicitado.");
    }
}
