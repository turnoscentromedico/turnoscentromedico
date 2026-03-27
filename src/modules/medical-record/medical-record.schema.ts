import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination";

export const createMedicalRecordSchema = z.object({
  date: z.coerce.date(),
  reason: z.string().optional(),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  prescriptions: z.string().optional(),
  studies: z.string().optional(),
  observations: z.string().optional(),
  weight: z.number().positive().optional(),
  height: z.number().positive().optional(),
  bloodPressure: z.string().optional(),
  temperature: z.number().positive().optional(),
  heartRate: z.number().int().positive().optional(),
});

export type CreateMedicalRecordInput = z.infer<typeof createMedicalRecordSchema>;

export const updateMedicalRecordSchema = createMedicalRecordSchema.partial();

export type UpdateMedicalRecordInput = z.infer<typeof updateMedicalRecordSchema>;

export const medicalRecordQuerySchema = paginationQuerySchema.extend({
  entryType: z.string().optional(),
});

export type MedicalRecordQuery = z.infer<typeof medicalRecordQuerySchema>;
