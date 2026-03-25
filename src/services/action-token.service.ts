import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { addHours } from "date-fns";

export type TokenAction = "confirm" | "cancel";

const TOKEN_EXPIRY_HOURS = 72;

export class ActionTokenService {
  constructor(private readonly prisma: PrismaClient) {}

  async generateTokens(
    appointmentId: number,
  ): Promise<{ confirmToken: string; cancelToken: string }> {
    const expiresAt = addHours(new Date(), TOKEN_EXPIRY_HOURS);

    const [confirmRow, cancelRow] = await this.prisma.$transaction([
      this.prisma.appointmentActionToken.create({
        data: {
          token: randomBytes(32).toString("hex"),
          appointmentId,
          action: "confirm" satisfies TokenAction,
          expiresAt,
        },
      }),
      this.prisma.appointmentActionToken.create({
        data: {
          token: randomBytes(32).toString("hex"),
          appointmentId,
          action: "cancel" satisfies TokenAction,
          expiresAt,
        },
      }),
    ]);

    return {
      confirmToken: confirmRow.token,
      cancelToken: cancelRow.token,
    };
  }

  async validateAndConsume(token: string) {
    const row = await this.prisma.appointmentActionToken.findUnique({
      where: { token },
      include: {
        appointment: {
          include: { patient: true, doctor: true, clinic: true, specialty: true },
        },
      },
    });

    if (!row) return { valid: false, error: "Token inválido" } as const;
    if (row.usedAt) return { valid: false, error: "Este enlace ya fue utilizado" } as const;
    if (row.expiresAt < new Date()) return { valid: false, error: "Este enlace ha expirado" } as const;

    await this.prisma.appointmentActionToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });

    return {
      valid: true,
      action: row.action as TokenAction,
      appointment: row.appointment,
    } as const;
  }
}
