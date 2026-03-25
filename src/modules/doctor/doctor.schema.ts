import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination";

export const createDoctorSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dni: z.string().min(1).max(20),
  nationality: z.string().max(100).nullish(),
  dateOfBirth: z.coerce.date().nullish(),
  phone: z.string().max(50).nullish(),
  address: z.string().max(500).nullish(),
  licenseNumber: z.string().min(1).max(50),
  specialtyId: z.number().int().positive(),
  clinicId: z.number().int().positive(),
});

export const updateDoctorSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  dni: z.string().min(1).max(20).optional(),
  nationality: z.string().max(100).nullish(),
  dateOfBirth: z.coerce.date().nullish(),
  phone: z.string().max(50).nullish(),
  address: z.string().max(500).nullish(),
  licenseNumber: z.string().min(1).max(50).optional(),
  specialtyId: z.number().int().positive().optional(),
  clinicId: z.number().int().positive().optional(),
});

export const doctorIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const doctorQuerySchema = z.object({
  specialtyId: z.coerce.number().int().positive().optional(),
  clinicId: z.coerce.number().int().positive().optional(),
}).merge(paginationQuerySchema);

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type DoctorQuery = z.infer<typeof doctorQuerySchema>;
