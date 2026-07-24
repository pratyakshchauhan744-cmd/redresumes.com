import { PrismaClient } from '@prisma/client';

const localPrisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:postgres@127.0.0.1:5433/redresumes?schema=public' } }
});

const railwayPrisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:AhZdamnceJChSgTZPkFptiuLXuCtIsGw@trolley.proxy.rlwy.net:19785/railway' } }
});

async function main() {
  try {
    const userToMigrate = await localPrisma.user.findFirst({
      where: { email: 'arvind@redresumes.com' }, // User in the screenshot is arvind@redresumes.com
      include: {
        applications: true,
        savedJobs: true,
      }
    });

    if (!userToMigrate) {
      console.log("Local user not found for arvind@redresumes.com. Falling back to arvindsingh@gmail.com just in case.");
      const fallbackUser = await localPrisma.user.findFirst({
          where: { email: 'arvindsingh@gmail.com' }
      });
      if (!fallbackUser) {
          console.log("No Arvind user found.");
          return;
      }
      
      const existingInRailway = await railwayPrisma.user.findUnique({
        where: { email: fallbackUser.email }
      });

      if (!existingInRailway) {
          await railwayPrisma.user.create({ data: fallbackUser });
          console.log("Migrated arvindsingh@gmail.com");
      }
      return;
    }

    const { applications, savedJobs, ...userData } = userToMigrate;

    const existingInRailway = await railwayPrisma.user.findUnique({
      where: { email: userToMigrate.email }
    });

    if (existingInRailway) {
      console.log("User already migrated to Railway!");
      return;
    }

    await railwayPrisma.user.create({
      data: userData
    });

    // We also need to insert a SignInEvent manually so it shows up in the admin panel telemetry!
    await railwayPrisma.signInEvent.create({
        data: {
            userId: userData.id,
            method: 'email_password'
        }
    });

    console.log("User successfully migrated to Railway and injected a SignInEvent!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await localPrisma.$disconnect();
    await railwayPrisma.$disconnect();
  }
}

main();
