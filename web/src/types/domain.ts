import type { Timestamp } from "firebase/firestore";

export type UserRole = "trainer" | "assistant" | "student";
export type StudentStatus = "pending" | "active" | "blocked" | "inactive";
export type BookingStatus = "scheduled" | "attended" | "no_show" | "cancelled";
export type ClassProductType = "single" | "package";
export type PurchaseStatus = "awaiting_payment" | "payment_submitted" | "paid" | "rejected";
export type TrainingModality =
  | "Musculação"
  | "Funcional"
  | "Cross Fit"
  | "Jiu Jitsu"
  | "Muay Thai"
  | "Boxe"
  | "Pilates"
  | "Ioga"
  | "HIIT";

export type GymLocationType = "gym" | "home" | "condo" | "outdoor";

export interface GymLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  type: GymLocationType;
}

export interface Branding {
  heroPhotoURL?: string;
  trainerPhotoURL?: string;
  bannerPhotoURL?: string;
  logoURL?: string;
  primaryColor: string;
  secondaryColor?: string;
  welcomeMessage: string;
  bio: string;
}

export interface PublicProfileSettings {
  showAgenda: boolean;
  showPrices: boolean;
  showPhotos: boolean;
}

export interface TrainerAvailabilityDay {
  weekday: "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado" | "domingo";
  active: boolean;
  morningStartTime: string;
  morningEndTime: string;
  afternoonStartTime: string;
  afternoonEndTime: string;
  /** Duração efetiva da aula em minutos */
  classDurationMinutes: number;
  /** Tempo de deslocamento entre atendimentos (min). Próximo slot = classDuration + travelMinutes */
  travelMinutes: number;
  /** Local padrão deste bloco de horário */
  locationId?: string;
}

export interface TeamSettings {
  cancelWindowHours: number;
  reminderHoursBefore: number;
  reminderAuto: boolean;
  reminderTemplate: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  ownerUid: string;
  isSolo: boolean;
  branding: Branding;
  settings: TeamSettings;
  publicListing: boolean;
  trainingModalities: TrainingModality[];
  publicProfile: PublicProfileSettings;
  /** Academias / locais onde o treinador atende */
  worksAt: GymLocation[];
  /** Aceita atendimento domiciliar */
  acceptsHomeVisit: boolean;
  /** Aceita academia de condomínio */
  acceptsCondoGym: boolean;
}

export interface Plan {
  id: string;
  name: string;
  priceCents: number;
  billingCycle: "monthly";
  classesPerMonth: number;
  active: boolean;
}

export interface ClassProduct {
  id: string;
  teamId: string;
  trainerId: string;
  name: string;
  type: ClassProductType;
  classesCount: number;
  priceCents: number;
  active: boolean;
  publicVisible: boolean;
  description: string;
}

export interface PromotionalPackage extends ClassProduct {
  type: "package";
  promotional: true;
  audience: "all_students" | "selected_students";
  targetStudentIds?: string[];
  offeredQuantity: number;
  soldQuantity: number;
  availableUntilRemoved: boolean;
}

export interface Student {
  uid: string;
  displayName: string;
  photoURL?: string;
  status: StudentStatus;
  assignedTo: string;
  onboarding: {
    idade?: number;
    birthDate?: string;
    genero?: string;
    email?: string;
    celular?: string;
  };
  physiological: {
    alturaCm?: number;
    pesoInicialKg?: number;
  };
  planId?: string;
  classesQuotaMonth?: number;
  classesUsedMonth?: number;
  lgpdConsentAt?: Timestamp;
  contractAcceptedAt?: Timestamp;
  contractVersion?: string;
}

export interface ClassPurchase {
  id: string;
  studentId: string;
  productId: string;
  productName: string;
  classesCount: number;
  amountCents: number;
  status: PurchaseStatus;
  submittedAt?: string;
  proofFileName?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface StudentMeasurement {
  id: string;
  studentId: string;
  measuredAt: string;
  weightKg: number;
  waistCm: number;
  hipCm: number;
  chestCm: number;
  bodyFatPercent?: number;
  notes?: string;
}

export interface StudentMeasurementSubmission extends StudentMeasurement {
  submittedBy: string;
  submittedByName: string;
  status: "pending" | "accepted" | "rejected";
}

export interface WorkoutSession {
  id: string;
  studentId: string;
  studentName?: string;
  trainerId: string;
  title: string;
  modality: TrainingModality;
  startsAt: string;
  address?: string;
  proposedWorkout?: string;
  durationMinutes: number;
  plannedCalories: number;
  status: "scheduled" | "in_progress" | "completed";
  exercises: string[];
}

export interface Booking {
  id: string;
  studentId: string;
  trainerId: string;
  startsAt: Timestamp;
  endsAt: Timestamp;
  focus: string;
  status: BookingStatus;
  noShowJustification?: string;
  cancelledAt?: Timestamp;
}

export interface PublicScheduleSlot {
  id: string;
  teamId: string;
  trainerName: string;
  weekday: string;
  time: string;
  /** Duração da aula em minutos */
  durationMinutes: number;
  /** Tempo de deslocamento em minutos (bloqueado após a aula) */
  travelMinutes: number;
  capacity: number;
  available: number;
  publicVisible: boolean;
  /** Local onde essa aula acontece */
  locationId?: string;
  locationName?: string;
}

export interface SessionClaims {
  role?: UserRole;
  teamId?: string;
}
