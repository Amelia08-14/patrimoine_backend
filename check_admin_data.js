
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log("Checking pending announces...");
    const pendingAnnounces = await prisma.announce.findMany({
      where: {
        status: 'WAITING_VALIDATION'
      },
      include: {
          user: true,
          property: true
      }
    });
    console.log(`Found ${pendingAnnounces.length} pending announces.`);
    if (pendingAnnounces.length > 0) {
        console.log("First pending announce:", JSON.stringify(pendingAnnounces[0], null, 2));
    }

    console.log("\nChecking pending users...");
    const pendingUsers = await prisma.user.findMany({
        where: {
            adminVerified: false,
            NOT: {
                userType: 'ADMIN'
            }
        }
    });
    console.log(`Found ${pendingUsers.length} pending users.`);

  } catch (error) {
    console.error("Error checking data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
