import type { Timestamp } from "firebase/firestore";

export type UserRole = "trainer" | "assistant" | "student";
export type StudentStatus = "pending" | "active" | "blocked" | "inactive";
export type BookingStatus = "scheduled" | "attended" | "no_show" | "cancelled";
export type ClassProductType = "single" | "package";
export type PurchaseStatus = "awaiting_payment" | "payment_submitted" | "paid" | "rejected";
export type EnrollmentStatus = "pending" | "active" | "paused" | "cancelled";
export type TeamMemberStatus = "pending" | "requesting_join" | "active" | "removed";

/**
 * Vínculo entre o treinador dono do time e um sub-treinador.
 * O sub-treinador continua tendo seu próprio perfil/time independente.
 */
export interface TeamMember {
  id: string;              // `${ownerUid}__${subTrainerId}`
  ownerUid: string;        // UID do treinador dono do time
  ownerName?: string;      // nome denormalizado do dono
  subTrainerId: string;    // UID do sub-treinador
  subTrainerName: string;
  subTrainerEmail: string;
  status: TeamMemberStatus;
  invitedAt: string;       // ISO date
  acceptedAt?: string;
}
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

export interface TrainerChat {
  id: string;              // `${trainer1Id}__${trainer2Id}` (alfabetico)
  requesterId: string;     // Quem pediu
  requesterName: string;
  targetId: string;        // Quem recebe
  targetName: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;       // ISO date
  updatedAt: string;
  lastMessageAt?: string;
  lastMessageText?: string;
  unreadBy?: string[];
  blockedBy?: string[];
}

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
  enableWhatsAppContact?: boolean;
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
  /** Cidade principal de atuação do treinador */
  city?: string;
  /** Telefone/WhatsApp de contato, revelado ao aluno após o vínculo ativo */
  contactPhone?: string;
  /** Academias / locais onde o treinador atende */
  worksAt: GymLocation[];
  /** Aceita atendimento domiciliar */
  acceptsHomeVisit: boolean;
  /** Aceita academia de condomínio */
  acceptsCondoGym: boolean;
  /** Grade de horários do treinador */
  availability?: TrainerAvailabilityDay[];
  /** Chave PIX para recebimento de pagamentos */
  pixKey?: string;
}

export interface Plan {
  id: string;
  name: string;
  priceCents: number;
  billingCycle: "monthly";
  classesPerMonth: number;
  active: boolean;
}

/** Quem enxerga a oferta: todos (vitrine pública), apenas alunos vinculados, ou alunos específicos. */
export type ProductAudience = "all" | "students" | "specific";

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
  /** Público-alvo da oferta (padrão "all"). */
  audience?: ProductAudience;
  /** Quando audience === "specific", ids dos alunos que podem ver/comprar. */
  targetStudentIds?: string[];
  /** Quantidade ofertada (0/undefined = ilimitado). */
  offeredQuantity?: number;
  /** Quantidade já vendida (confirmada). */
  soldQuantity?: number;
}

export interface PromotionalPackage extends ClassProduct {
  type: "package";
  promotional: true;
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
    city?: string;
  };
  physiological: {
    alturaCm?: number;
    pesoInicialKg?: number;
  };
  medicalData?: {
    doencas?: string;
    restricoes?: string;
    orientacoes?: string;
  };
  goal?: string;
  createdAt?: string;
  planId?: string;
  classesQuotaMonth?: number;
  classesUsedMonth?: number;
  lgpdConsentAt?: Timestamp;
  contractAcceptedAt?: Timestamp;
  contractVersion?: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderRole: "student" | "trainer";
  createdAt: string; // ISO format
  read: boolean;
}

/**
 * Vínculo entre um aluno e um treinador. Um aluno pode ter vários vínculos
 * (vários treinadores) e alternar entre eles. Cada vínculo tem o próprio
 * saldo de aulas e ciclo de aprovação.
 */
export interface Enrollment {
  id: string; // `${studentId}__${trainerId}`
  studentId: string;
  studentName: string;
  trainerId: string; // == teamId do treinador
  teamName?: string; // denormalizado para listagem do aluno
  status: EnrollmentStatus;
  classesQuota: number; // saldo de aulas com ESTE treinador
  classesUsed: number;
  createdAt: string;
  approvedAt?: string;
  lastMessageAt?: string;
  lastMessageText?: string;
  unreadBy?: string[];
  blockedBy?: string[];
}

export interface ClassPurchase {
  id: string;
  studentId: string;
  trainerId?: string;
  teamId?: string;
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
  // Todas as medidas são opcionais — o aluno pode acompanhar só o que quiser.
  weightKg?: number;
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  bodyFatPercent?: number;
  armRightCm?: number;
  thighCm?: number;
  calfCm?: number;
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
  status: "scheduled" | "in_progress" | "completed" | "no_show";
  exercises: string[];
  trainingId?: string;
  startedAt?: string;
  completedAt?: string;
  actualDurationMinutes?: number;
  studentStartedAt?: string;
  studentCompletedAt?: string;
  /** UID do sub-treinador que executa a aula. trainerId permanece o dono (para crédito). */
  assignedToId?: string;
  /** Nome denormalizado do sub-treinador */
  assignedToName?: string;
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

export interface Exercise {
  order: number;
  name: string;
  sets?: string;
  rest?: string;
  notes?: string;
  videoUrl?: string;
}

export interface Training {
  id: string;
  trainerId: string;
  studentId?: string;
  studentName?: string;
  enrollmentId?: string;
  title: string;
  description?: string;
  exercises: Exercise[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface TrainingLog {
  id: string;
  trainingId: string;
  studentId: string;
  trainerId: string;
  enrollmentId: string;
  trainingTitle: string;
  completedByStudent: boolean;
  confirmedByTrainer: boolean;
  completedAt?: string;
  confirmedAt?: string;
  studentNotes?: string;
  createdAt: string;
}

export interface SessionClaims {
  role?: UserRole;
  teamId?: string;
}
