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

