import { z } from "zod";

export const createScheduleSchema = z.object({
  doctorId: z.number().int().positive(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm"),
  slotDuration: z.number().int().min(5).max(120).default(30),
  lunchBreakStart: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm").nullable().optional(),
  lunchBreakEnd: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm").nullable().optional(),
  active: z.boolean().default(true),
});

export const updateScheduleSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  slotDuration: z.number().int().min(5).max(120).optional(),
  lunchBreakStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  lunchBreakEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  active: z.boolean().optional(),
});

const bulkScheduleItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm"),
  slotDuration: z.number().int().min(5).max(120).default(30),
  lunchBreakStart: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm").nullable().optional(),
  lunchBreakEnd: z.string().regex(/^\d{2}:\d{2}$/, "Expected HH:mm").nullable().optional(),
  active: z.boolean().default(true),
});

export const bulkScheduleSchema = z.object({
  schedules: z.array(bulkScheduleItemSchema),
});

export const scheduleIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const scheduleByDoctorSchema = z.object({
  doctorId: z.coerce.number().int().positive(),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type BulkScheduleInput = z.infer<typeof bulkScheduleSchema>;
