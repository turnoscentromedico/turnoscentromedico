import { z } from "zod";

export const specialtyCore = {
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullish(),
};

export const createSpecialtySchema = z.object(specialtyCore);

export const updateSpecialtySchema = z.object({
  name: specialtyCore.name.optional(),
  description: specialtyCore.description,
});

export const specialtyIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateSpecialtyInput = z.infer<typeof createSpecialtySchema>;
export type UpdateSpecialtyInput = z.infer<typeof updateSpecialtySchema>;
