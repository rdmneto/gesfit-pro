import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});
export type LoginFormData = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    name: z.string().min(2, "Nome obrigatório"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "Mínimo 6 caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não coincidem",
    path: ["confirm"],
  });
export type SignupFormData = z.infer<typeof signupSchema>;

const optionalFloat = z.coerce.number().positive("Valor inválido").max(999).optional().or(z.literal("").transform(() => undefined));

export const measurementSchema = z.object({
  measuredAt: z.string().min(1, "Data obrigatória"),
  weightKg: z.coerce.number({ invalid_type_error: "Peso inválido" }).min(20, "Peso muito baixo").max(300),
  waistCm: z.coerce.number({ invalid_type_error: "Medida inválida" }).min(30).max(200),
  hipCm: z.coerce.number({ invalid_type_error: "Medida inválida" }).min(30).max(200),
  chestCm: z.coerce.number({ invalid_type_error: "Medida inválida" }).min(30).max(200),
  bodyFatPercent: optionalFloat,
  armRightCm: optionalFloat,
  thighCm: optionalFloat,
  calfCm: optionalFloat,
  notes: z.string().optional(),
});
export type MeasurementFormData = z.infer<typeof measurementSchema>;

export const classProductSchema = z.object({
  name: z.string().min(3, "Nome obrigatório"),
  type: z.enum(["single", "package"]),
  classesCount: z.coerce.number().min(1).max(200),
  priceCents: z.coerce.number().min(100, "Valor mínimo R$ 1,00"),
  description: z.string().optional(),
  publicVisible: z.boolean().default(true),
  active: z.boolean().default(true),
});
export type ClassProductFormData = z.infer<typeof classProductSchema>;

export const bookingSchema = z.object({
  date: z.string().min(1, "Data obrigatória"),
  time: z.string().min(1, "Horário obrigatório"),
  notes: z.string().optional(),
});
export type BookingFormData = z.infer<typeof bookingSchema>;

export const studentOnboardingSchema = z.object({
  celular: z.string().min(10, "Telefone inválido").max(15, "Telefone muito longo"),
  cidade: z.string().min(2, "Cidade obrigatória"),
  birthDate: z.string().min(10, "Data de nascimento inválida"),
  alturaCm: z.coerce.number({ invalid_type_error: "Altura inválida" }).min(50).max(250),
  pesoKg: z.coerce.number({ invalid_type_error: "Peso inválido" }).min(20).max(300),
  objetivos: z.string().min(3, "Descreva seus objetivos").max(500),
  doencas: z.string().optional(),
  restricoes: z.string().optional(),
  orientacoes: z.string().optional(),
});
export type StudentOnboardingData = z.infer<typeof studentOnboardingSchema>;

export const trainerOnboardingSchema = z.object({
  teamName: z.string().min(3, "Nome do time deve ter ao menos 3 caracteres").max(50),
  teamSlug: z.string().min(3, "Link deve ter ao menos 3 caracteres").regex(/^[a-z0-9-]+$/, "O link deve conter apenas letras minúsculas, números e hifens"),
  bio: z.string().optional(),
});
export type TrainerOnboardingData = z.infer<typeof trainerOnboardingSchema>;

export const studentProfileSchema = z.object({
  displayName: z.string().min(2, "Nome obrigatório"),
  celular: z.string().min(10, "Telefone inválido").max(15, "Telefone muito longo").optional(),
  cidade: z.string().optional(),
  birthDate: z.string().optional(),
  genero: z.string().optional(),
  alturaCm: z.coerce.number({ invalid_type_error: "Altura inválida" }).min(50).max(250).optional().or(z.literal("").transform(() => undefined)),
  pesoInicialKg: z.coerce.number({ invalid_type_error: "Peso inválido" }).min(20).max(300).optional().or(z.literal("").transform(() => undefined)),
  objetivos: z.string().optional(),
});
export type StudentProfileData = z.infer<typeof studentProfileSchema>;
