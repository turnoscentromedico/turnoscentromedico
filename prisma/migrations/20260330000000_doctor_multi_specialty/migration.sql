-- CreateTable (implicit M:N join)
CREATE TABLE "_DoctorToSpecialty" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_DoctorToSpecialty_A_fkey" FOREIGN KEY ("A") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DoctorToSpecialty_B_fkey" FOREIGN KEY ("B") REFERENCES "specialties"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_DoctorToSpecialty_AB_unique" ON "_DoctorToSpecialty"("A", "B");
CREATE INDEX "_DoctorToSpecialty_B_index" ON "_DoctorToSpecialty"("B");

-- Migrate existing data: copy each doctor's specialtyId into the join table
INSERT INTO "_DoctorToSpecialty" ("A", "B")
SELECT "id", "specialtyId" FROM "doctors" WHERE "specialtyId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop old FK and column
ALTER TABLE "doctors" DROP CONSTRAINT IF EXISTS "doctors_specialtyId_fkey";
ALTER TABLE "doctors" DROP COLUMN IF EXISTS "specialtyId";
