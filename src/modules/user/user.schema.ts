import { z } from "zod";

export const createUserSchema = z.object({
  clerkUserId: z.string().min(1),
  name: z.string().min(1).max(200),
  email: z.string().email().max(255),
  role: z.enum(["ADMIN", "OPERATOR", "DOCTOR", "STANDARD"]).default("OPERATOR"),
  clinicIds: z.array(z.number().int().positive()).optional(),
  doctorId: z.number().int().positive().nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(255).optional(),
  role: z.enum(["ADMIN", "OPERATOR", "DOCTOR", "STANDARD"]).optional(),
  clinicIds: z.array(z.number().int().positive()).optional(),
  doctorId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
});

export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
