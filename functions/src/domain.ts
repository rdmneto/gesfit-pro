import type { Timestamp } from "firebase-admin/firestore";

export type UserRole = "trainer" | "assistant" | "student";
export type StudentStatus = "pending" | "active" | "blocked" | "inactive";
export type BookingStatus = "scheduled" | "attended" | "no_show" | "cancelled";
export type PaymentGatewayName = "asaas" | "mercado_pago";

export interface TeamSettings {
  cancelWindowHours: number;
  reminderHoursBefore: number;
  reminderAuto: boolean;
  reminderTemplate: string;
}

export interface Team {
  name: string;
  slug: string;
  ownerUid: string;
  isSolo: boolean;
  branding: {
    heroPhotoURL?: string;
    logoURL?: string;
    primaryColor: string;
    welcomeMessage: string;
    bio: string;
  };
  settings: TeamSettings;
  publicListing: boolean;
  createdAt: Timestamp;
}

export interface Student {
  uid: string;
  displayName: string;
  photoURL?: string;
  status: StudentStatus;
  assignedTo: string;
  onboarding: {
    idade?: number;
    genero?: string;
    email?: string;
    celular?: string;
  };
  physiological: {
    alturaCm?: number;
    pesoInicialKg?: number;
  };
  planId?: string;
  planStartsAt?: Timestamp;
  planEndsAt?: Timestamp;
  classesQuotaMonth?: number;
  classesUsedMonth?: number;
  lgpdConsentAt?: Timestamp;
  contractAcceptedAt?: Timestamp;
  contractVersion?: string;
}

export interface Booking {
  studentId: string;
  trainerId: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  focus: string;
  status: BookingStatus;
  reminderSentAt?: Timestamp;
  noShowJustification?: string;
  createdAt: Timestamp;
  cancelledAt?: Timestamp;
}

export interface Subscription {
  gateway: PaymentGatewayName;
  gatewaySubscriptionId: string;
  status: string;
  lastPaymentStatus: string;
  nextDueDate?: string;
  updatedAt: Timestamp;
}
