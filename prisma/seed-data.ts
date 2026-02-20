import { PrismaClient, UserType, TransactionType, AnnounceStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create Admin
  const adminPassword = await bcrypt.hash('adminPassword123!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@patrimoine.dz' },
    update: {},
    create: {
      email: 'admin@patrimoine.dz',
      passwordHash: adminPassword,
      userType: UserType.ADMIN,
      firstName: 'Admin',
      lastName: 'System',
      activated: true,
      adminVerified: true,
    },
  });

  // 2. Create Agency User
  const userPassword = await bcrypt.hash('123456789', 10);
  const agency = await prisma.user.upsert({
    where: { email: 'contact@yahiaimmo.dz' },
    update: {},
    create: {
      email: 'contact@yahiaimmo.dz',
      passwordHash: userPassword,
      userType: UserType.SOCIETE,
      companyName: 'Agence Immobilière Yahia Immo',
      firstName: 'Yahia',
      lastName: 'Ben',
      phone: '0550123456',
      address: 'Hydra, Alger',
      activated: true,
      adminVerified: true,
      imageUrl: 'uploads/agency-logo.png' // You might need a real image or placeholder
    },
  });

  // 3. Create Particular User
  const particular = await prisma.user.upsert({
    where: { email: 'amel.benelhadj14@gmail.com' },
    update: {},
    create: {
      email: 'amel.benelhadj14@gmail.com',
      passwordHash: userPassword,
      userType: UserType.PARTICULIER,
      firstName: 'Amel',
      lastName: 'Benelhadj',
      phone: '0660123456',
      address: 'Oran',
      activated: true,
      adminVerified: true,
    },
  });

  // 4. Create Cities/Towns (Simplified for demo if not exists)
  // Check if we have cities, if not create dummy one
  let city = await prisma.city.findFirst({ where: { code: 16 } });
  if (!city) {
    city = await prisma.city.create({
      data: {
        nameAr: 'الجزائر',
        nameFr: 'Alger',
        nameEn: 'Algiers',
        code: 16,
        towns: {
            create: [
                { nameAr: 'حيدرة', nameFr: 'Hydra', nameEn: 'Hydra' },
                { nameAr: 'بن عكنون', nameFr: 'Ben Aknoun', nameEn: 'Ben Aknoun' }
            ]
        }
      }
    });
  }
  
  const town = await prisma.town.findFirst({ where: { cityId: city.id } });

  // 5. Create Announcements
  const announce1 = await prisma.announce.create({
    data: {
      reference: 'REF-001',
      status: AnnounceStatus.VALIDATED,
      type: TransactionType.SALE,
      price: 45000000,
      userId: agency.id,
      nbViews: 125,
      property: {
        create: {
          area: 145,
          nbRooms: 4,
          description: 'Magnifique appartement F4 haut standing à Hydra avec vue dégagée.',
          propertyType: 'Appartement',
          address: {
            create: {
                street: 'Rue des Pins',
                townId: town!.id
            }
          },
          images: {
            create: [
                { url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80', isMain: true }
            ]
          }
        }
      }
    }
  });

  const announce2 = await prisma.announce.create({
    data: {
      reference: 'REF-002',
      status: AnnounceStatus.VALIDATED,
      type: TransactionType.RENTAL,
      price: 85000,
      userId: agency.id,
      nbViews: 340,
      property: {
        create: {
          area: 350,
          nbRooms: 7,
          description: 'Villa moderne avec piscine chauffée et jardin.',
          propertyType: 'Villa',
          address: {
            create: {
                street: 'Chemin Mackley',
                townId: town!.id
            }
          },
          images: {
            create: [
                { url: 'https://images.unsplash.com/photo-1600596542815-2a4d04774c13?auto=format&fit=crop&w=800&q=80', isMain: true }
            ]
          }
        }
      }
    }
  });
  
  const announce3 = await prisma.announce.create({
    data: {
      reference: 'REF-003',
      status: AnnounceStatus.VALIDATED,
      type: TransactionType.SALE,
      price: 22000000,
      userId: particular.id,
      nbViews: 45,
      property: {
        create: {
          area: 90,
          nbRooms: 3,
          description: 'Appartement F3 ensoleillé proche de toutes commodités.',
          propertyType: 'Appartement',
          address: {
            create: {
                street: 'Centre Ville',
                townId: town!.id
            }
          },
          images: {
            create: [
                { url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80', isMain: true }
            ]
          }
        }
      }
    }
  });

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
