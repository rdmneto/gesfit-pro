import type { ClassProduct, ProductAudience } from "../types/domain";

export function productAudience(p: ClassProduct): ProductAudience {
  return (p.audience as ProductAudience) ?? "all";
}

/** Estoque disponível? offeredQuantity 0/undefined = ilimitado. */
export function hasStock(p: ClassProduct): boolean {
  const offered = p.offeredQuantity ?? 0;
  if (offered <= 0) return true;
  return (p.soldQuantity ?? 0) < offered;
}

/** Restantes (null = ilimitado). */
export function remainingStock(p: ClassProduct): number | null {
  const offered = p.offeredQuantity ?? 0;
  if (offered <= 0) return null;
  return Math.max(offered - (p.soldQuantity ?? 0), 0);
}

/** Visível para um aluno específico (vinculado). */
export function visibleToStudent(p: ClassProduct, studentId: string): boolean {
  if (productAudience(p) === "specific") {
    return (p.targetStudentIds ?? []).includes(studentId);
  }
  return true; // all | students
}

/** Visível na vitrine pública (visitantes). */
export function visiblePublic(p: ClassProduct): boolean {
  return productAudience(p) === "all";
}

export const AUDIENCE_LABEL: Record<ProductAudience, string> = {
  all: "Todos (vitrine pública)",
  students: "Apenas meus alunos",
  specific: "Alunos específicos",
};
