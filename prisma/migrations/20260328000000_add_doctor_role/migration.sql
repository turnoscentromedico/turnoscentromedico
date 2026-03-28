-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'DOCTOR';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "doctorId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "users_doctorId_key" ON "users"("doctorId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
