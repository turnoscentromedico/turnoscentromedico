import { z } from "zod";
import { paginationQuerySchema } from "../../utils/pagination";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected format YYYY-MM-DD");

const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Expected format HH:mm");

export const availableSlotsQuerySchema = z.object({
  clinicId: z.coerce.number().int().positive(),
  doctorId: z.coerce.number().int().positive(),
  date: dateString,
});

export const availableBySpecialtyQuerySchema = z.object({
  clinicId: z.coerce.number().int().positive(),
  specialtyId: z.coerce.number().int().positive(),
  date: dateString,
});

export const bookAppointmentSchema = z.object({
  clinicId: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  patientId: z.number().int().positive(),
  date: dateString,
  startTime: timeString,
  notes: z.string().max(1000).nullish(),
});

export const listAppointmentsQuerySchema = z.object({
  clinicId: z.coerce.number().int().positive().optional(),
  doctorId: z.coerce.number().int().positive().optional(),
  patientId: z.coerce.number().int().positive().optional(),
  date: dateString.optional(),
}).merge(paginationQuerySchema);

export const availableRangeQuerySchema = z
  .object({
    clinicId: z.coerce.number().int().positive(),
    doctorId: z.coerce.number().int().positive().optional(),
    specialtyId: z.coerce.number().int().positive().optional(),
    startDate: dateString,
    endDate: dateString,
  })
  .refine((d) => d.doctorId || d.specialtyId, {
    message: "Either doctorId or specialtyId is required",
  });

export const appointmentIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type AvailableSlotsQuery = z.infer<typeof availableSlotsQuerySchema>;
export type AvailableBySpecialtyQuery = z.infer<typeof availableBySpecialtyQuerySchema>;
export type AvailableRangeQuery = z.infer<typeof availableRangeQuerySchema>;
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
