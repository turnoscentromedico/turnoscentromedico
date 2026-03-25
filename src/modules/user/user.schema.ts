import { z } from "zod";

export const createUserSchema = z.object({
  clerkUserId: z.string().min(1),
  name: z.string().min(1).max(200),
  email: z.string().email().max(255),
  role: z.enum(["ADMIN", "OPERATOR", "STANDARD"]).default("OPERATOR"),
  clinicIds: z.array(z.number().int().positive()).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(255).optional(),
  role: z.enum(["ADMIN", "OPERATOR", "STANDARD"]).optional(),
  clinicIds: z.array(z.number().int().positive()).optional(),
  active: z.boolean().optional(),
});

export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
