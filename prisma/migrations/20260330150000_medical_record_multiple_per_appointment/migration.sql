-- DropIndex: remove unique constraint on appointmentId to allow multiple medical records per appointment
DROP INDEX IF EXISTS "medical_records_appointmentId_key";
