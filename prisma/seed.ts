import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const clerkUserId = process.env.ADMIN_CLERK_USER_ID;
  const email = process.env.ADMIN_EMAIL || "admin@tuclinica.com";
  const name = process.env.ADMIN_NAME || "Administrador";

  if (!clerkUserId) {
    console.error(
      "ERROR: Set ADMIN_CLERK_USER_ID env var with your Clerk user ID.\n" +
      "You can find it in https://dashboard.clerk.com → Users → your user → User ID\n\n" +
      "Usage:\n" +
      '  ADMIN_CLERK_USER_ID=user_xxx ADMIN_EMAIL=you@mail.com npx prisma db seed\n',
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { clerkUserId } });
  if (existing) {
    console.log(`Admin already exists: ${existing.email} (role: ${existing.role})`);
    return;
  }

  const admin = await prisma.user.create({
    data: {
      clerkUserId,
      name,
      email,
      role: "ADMIN",
    },
  });

  console.log(`\nAdmin created successfully!`);
  console.log(`  ID:      ${admin.id}`);
  console.log(`  Name:    ${admin.name}`);
  console.log(`  Email:   ${admin.email}`);
  console.log(`  Role:    ${admin.role}`);
  console.log(`  ClerkID: ${admin.clerkUserId}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
