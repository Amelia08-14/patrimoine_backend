import { PrismaClient, UserType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@patrimoine.dz';
  const password = 'adminPassword123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash: hashedPassword,
      userType: UserType.ADMIN,
      firstName: 'Admin',
      lastName: 'System',
      activated: true,
      adminVerified: true,
      phone: '0000000000',
      address: 'System',
    },
  });

  console.log({ admin });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
