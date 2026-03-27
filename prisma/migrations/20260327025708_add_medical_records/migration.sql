-- CreateTable
CREATE TABLE "medical_records" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "appointmentId" INTEGER,
    "entryType" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "diagnosis" TEXT,
    "treatment" TEXT,
    "prescriptions" TEXT,
    "studies" TEXT,
    "observations" TEXT,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "bloodPressure" TEXT,
    "temperature" DOUBLE PRECISION,
    "heartRate" INTEGER,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_appointmentId_key" ON "medical_records"("appointmentId");

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
