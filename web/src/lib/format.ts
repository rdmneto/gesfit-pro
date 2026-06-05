export function moneyFromCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function shortDateTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function bmi(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm) {
    return null;
  }

  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

/** Monta um link wa.me a partir de um telefone (assume Brasil se sem DDI). */
export function whatsappLink(phone?: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (!digits.startsWith("55") && digits.length <= 11) digits = "55" + digits;
  return `https://wa.me/${digits}`;
}

export function calculateAge(birthDateString?: string, ageFallback?: number): number | undefined {
  if (birthDateString) {
    // Adiciona o timezone local para evitar problemas de fuso
    const birthDate = new Date(birthDateString + "T00:00:00");
    if (!isNaN(birthDate.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    }
  }
  return ageFallback;
}

