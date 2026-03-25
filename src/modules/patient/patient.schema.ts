import { z } from "zod";

export const createPatientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dni: z.string().min(1).max(20),
  nationality: z.string().min(1).max(100),
  dateOfBirth: z.coerce.date(),
  email: z.string().email().max(255).nullish(),
  phone: z.string().max(50).nullish(),
  address: z.string().max(500).nullish(),
  cuilCuit: z.string().max(20).nullish(),
});

export const updatePatientSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  dni: z.string().min(1).max(20).optional(),
  nationality: z.string().min(1).max(100).optional(),
  dateOfBirth: z.coerce.date().optional(),
  email: z.string().email().max(255).nullish(),
  phone: z.string().max(50).nullish(),
  address: z.string().max(500).nullish(),
  cuilCuit: z.string().max(20).nullish(),
});

export const patientIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
