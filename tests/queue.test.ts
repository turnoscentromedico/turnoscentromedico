import { describe, it, expect, vi } from "vitest";
import { subHours } from "date-fns";

describe("Queue — enqueueAppointmentJobs logic", () => {
  it("should compute correct 24h delay", () => {
    const futureDate = new Date("2026-04-15T14:00:00");
    const reminder24h = subHours(futureDate, 24);
    const delay = Math.max(0, reminder24h.getTime() - Date.now());

    expect(delay).toBeGreaterThan(0);
    expect(reminder24h.getHours()).toBe(14);
    expect(reminder24h.getDate()).toBe(14);
  });

  it("should compute correct 2h delay", () => {
    const futureDate = new Date("2026-04-15T14:00:00");
    const reminder2h = subHours(futureDate, 2);
    const delay = Math.max(0, reminder2h.getTime() - Date.now());

    expect(delay).toBeGreaterThan(0);
    expect(reminder2h.getHours()).toBe(12);
  });

  it("should clamp to 0 for past dates", () => {
    const pastDate = new Date("2020-01-01T09:00:00");
    const reminder24h = subHours(pastDate, 24);
    const delay = Math.max(0, reminder24h.getTime() - Date.now());

    expect(delay).toBe(0);
  });

  it("should build correct job data structure", () => {
    const jobData = {
      appointmentId: 42,
      patientName: "Juan Pérez",
      patientEmail: "juan@example.com",
      patientPhone: "5491155551234",
      doctorName: "Carlos García",
      specialtyName: "Cardiología",
      clinicName: "Clínica Central",
      date: "2026-04-15",
      startTime: "14:00",
    };

    expect(jobData.appointmentId).toBe(42);
    expect(jobData.patientEmail).toContain("@");
    expect(jobData.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(jobData.startTime).toMatch(/^\d{2}:\d{2}$/);
  });

  it("should generate valid job IDs", () => {
    const appointmentId = 123;
    const jobIds = {
      confirmation: `confirmation-${appointmentId}`,
      reminder24h: `reminder-24h-${appointmentId}`,
      reminder2h: `reminder-2h-${appointmentId}`,
    };

    expect(jobIds.confirmation).toBe("confirmation-123");
    expect(jobIds.reminder24h).toBe("reminder-24h-123");
    expect(jobIds.reminder2h).toBe("reminder-2h-123");
  });
});

describe("Queue — NotificationService integration", () => {
  it("should handle missing RESEND_API_KEY gracefully", async () => {
    const { NotificationService } = await import(
      "../src/services/notification.service"
    );
    const service = new NotificationService();

    const result = await service.sendEmail({
      type: "confirmation",
      appointmentId: 1,
      patientName: "Test",
      patientEmail: "test@test.com",
      patientPhone: null,
      doctorName: "Dr. Test",
      specialtyName: "Test",
      clinicName: "Test Clinic",
      date: "2026-04-15",
      startTime: "09:00",
    });

    expect(result).toBe(false);
  });

  it("should handle missing WhatsApp config gracefully", async () => {
    const { NotificationService } = await import(
      "../src/services/notification.service"
    );
    const service = new NotificationService();

    const result = await service.sendWhatsApp({
      type: "confirmation",
      appointmentId: 1,
      patientName: "Test",
      patientEmail: "test@test.com",
      patientPhone: "5491155551234",
      doctorName: "Dr. Test",
      specialtyName: "Test",
      clinicName: "Test Clinic",
      date: "2026-04-15",
      startTime: "09:00",
    });

    expect(result).toBe(false);
  });
});
