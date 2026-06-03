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
