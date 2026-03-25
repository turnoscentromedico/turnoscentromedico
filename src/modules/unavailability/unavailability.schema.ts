import { z } from "zod";

export const createUnavailabilitySchema = z.object({
  doctorId: z.number().int().positive(),
  date: z.coerce.date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm").nullish(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm").nullish(),
  reason: z.string().max(500).nullish(),
});

export const unavailabilityIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const unavailabilityByDoctorSchema = z.object({
  doctorId: z.coerce.number().int().positive(),
});

export type CreateUnavailabilityInput = z.infer<typeof createUnavailabilitySchema>;
