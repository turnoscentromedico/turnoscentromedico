import { z } from "zod";

export const clinicCore = {
  name: z.string().min(1).max(200),
  address: z.string().max(500).nullish(),
  phone: z.string().max(50).nullish(),
};

export const createClinicSchema = z.object(clinicCore);

export const updateClinicSchema = z.object({
  name: clinicCore.name.optional(),
  address: clinicCore.address,
  phone: clinicCore.phone,
});

export const clinicIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateClinicInput = z.infer<typeof createClinicSchema>;
export type UpdateClinicInput = z.infer<typeof updateClinicSchema>;
