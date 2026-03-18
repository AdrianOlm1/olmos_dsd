import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Users ──────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@olmosdsd.com' },
    update: {},
    create: {
      email: 'admin@olmosdsd.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
  });

  const driverUser = await prisma.user.upsert({
    where: { email: 'driver@olmosdsd.com' },
    update: {},
    create: {
      email: 'driver@olmosdsd.com',
      passwordHash,
      firstName: 'Mike',
      lastName: 'Johnson',
      role: 'DRIVER',
      driver: { create: { licenseNumber: 'DL-12345' } },
    },
    include: { driver: true },
  });

  const driver2User = await prisma.user.upsert({
    where: { email: 'driver2@olmosdsd.com' },
    update: {},
    create: {
      email: 'driver2@olmosdsd.com',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Williams',
      role: 'DRIVER',
      driver: { create: { licenseNumber: 'DL-67890' } },
    },
    include: { driver: true },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@olmosdsd.com' },
    update: {},
    create: {
      email: 'manager@olmosdsd.com',
      passwordHash,
      firstName: 'Lisa',
      lastName: 'Chen',
      role: 'MANAGER',
    },
  });

  // ─── Chains ─────────────────────────────────────────────────
  const kroger = await prisma.chain.upsert({
    where: { code: 'KRG' },
    update: {},
    create: { name: 'Kroger', code: 'KRG', dexSupported: true },
  });

  const publix = await prisma.chain.upsert({
    where: { code: 'PBX' },
    update: {},
    create: { name: 'Publix', code: 'PBX', dexSupported: true },
  });

  const albertsons = await prisma.chain.upsert({
    where: { code: 'ALB' },
    update: {},
    create: { name: 'Albertsons', code: 'ALB', dexSupported: true },
  });

  const independent = await prisma.chain.upsert({
    where: { code: 'IND' },
    update: {},
    create: { name: 'Independent', code: 'IND', dexSupported: false },
  });

  // ─── Categories ─────────────────────────────────────────────
  const beverages = await prisma.category.upsert({
    where: { name: 'Beverages' },
    update: {},
    create: { name: 'Beverages', sortOrder: 1 },
  });

  const snacks = await prisma.category.upsert({
    where: { name: 'Snacks' },
    update: {},
    create: { name: 'Snacks', sortOrder: 2 },
  });

  const dairy = await prisma.category.upsert({
    where: { name: 'Dairy' },
    update: {},
    create: { name: 'Dairy', sortOrder: 3 },
  });

  const frozen = await prisma.category.upsert({
    where: { name: 'Frozen' },
    update: {},
    create: { name: 'Frozen', sortOrder: 4 },
  });

  // ─── Products ───────────────────────────────────────────────
  const products = await Promise.all([
    prisma.product.upsert({ where: { sku: 'BEV-001' }, update: {}, create: { sku: 'BEV-001', upc: '012345678901', name: 'Spring Water 24pk', categoryId: beverages.id, basePrice: 4.99, costPrice: 2.50, unitOfMeasure: 'CASE', unitsPerCase: 24 } }),
    prisma.product.upsert({ where: { sku: 'BEV-002' }, update: {}, create: { sku: 'BEV-002', upc: '012345678902', name: 'Cola 12pk', categoryId: beverages.id, basePrice: 6.49, costPrice: 3.25, unitOfMeasure: 'CASE', unitsPerCase: 12 } }),
    prisma.product.upsert({ where: { sku: 'BEV-003' }, update: {}, create: { sku: 'BEV-003', upc: '012345678903', name: 'Orange Juice 64oz', categoryId: beverages.id, basePrice: 3.99, costPrice: 2.00, perishable: true } }),
    prisma.product.upsert({ where: { sku: 'SNK-001' }, update: {}, create: { sku: 'SNK-001', upc: '012345678904', name: 'Potato Chips Classic 10oz', categoryId: snacks.id, basePrice: 3.49, costPrice: 1.75 } }),
    prisma.product.upsert({ where: { sku: 'SNK-002' }, update: {}, create: { sku: 'SNK-002', upc: '012345678905', name: 'Tortilla Chips 13oz', categoryId: snacks.id, basePrice: 4.29, costPrice: 2.15 } }),
    prisma.product.upsert({ where: { sku: 'SNK-003' }, update: {}, create: { sku: 'SNK-003', upc: '012345678906', name: 'Pretzels 16oz', categoryId: snacks.id, basePrice: 3.79, costPrice: 1.90 } }),
    prisma.product.upsert({ where: { sku: 'DRY-001' }, update: {}, create: { sku: 'DRY-001', upc: '012345678907', name: 'Whole Milk 1gal', categoryId: dairy.id, basePrice: 4.29, costPrice: 2.80, perishable: true, lotTracked: true } }),
    prisma.product.upsert({ where: { sku: 'DRY-002' }, update: {}, create: { sku: 'DRY-002', upc: '012345678908', name: 'Greek Yogurt 32oz', categoryId: dairy.id, basePrice: 5.99, costPrice: 3.50, perishable: true, lotTracked: true } }),
    prisma.product.upsert({ where: { sku: 'FRZ-001' }, update: {}, create: { sku: 'FRZ-001', upc: '012345678909', name: 'Frozen Pizza 12in', categoryId: frozen.id, basePrice: 7.99, costPrice: 4.00, perishable: true } }),
    prisma.product.upsert({ where: { sku: 'FRZ-002' }, update: {}, create: { sku: 'FRZ-002', upc: '012345678910', name: 'Ice Cream Vanilla 1pt', categoryId: frozen.id, basePrice: 4.49, costPrice: 2.25, perishable: true } }),
  ]);

  // ─── Customers ──────────────────────────────────────────────
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { accountNumber: 'KRG-001' },
      update: {},
      create: {
        name: 'Kroger #1234 - Downtown',
        accountNumber: 'KRG-001',
        contactName: 'John Smith',
        email: 'store1234@kroger.com',
        phone: '555-0101',
        chainId: kroger.id,
        paymentTerms: 'NET30',
        locations: {
          create: {
            name: 'Main Entrance',
            addressLine1: '100 Main Street',
            city: 'Miami',
            state: 'FL',
            zip: '33101',
            latitude: 25.7617,
            longitude: -80.1918,
            receivingHoursStart: '06:00',
            receivingHoursEnd: '14:00',
            dexLocationCode: 'KRG1234',
          },
        },
      },
    }),
    prisma.customer.upsert({
      where: { accountNumber: 'PBX-001' },
      update: {},
      create: {
        name: 'Publix #567 - Coral Gables',
        accountNumber: 'PBX-001',
        contactName: 'Maria Garcia',
        email: 'store567@publix.com',
        phone: '555-0102',
        chainId: publix.id,
        paymentTerms: 'NET15',
        locations: {
          create: {
            name: 'Receiving Dock',
            addressLine1: '200 Miracle Mile',
            city: 'Coral Gables',
            state: 'FL',
            zip: '33134',
            latitude: 25.7497,
            longitude: -80.2589,
            receivingHoursStart: '05:00',
            receivingHoursEnd: '12:00',
            dexLocationCode: 'PBX567',
          },
        },
      },
    }),
    prisma.customer.upsert({
      where: { accountNumber: 'ALB-001' },
      update: {},
      create: {
        name: 'Albertsons #890 - Kendall',
        accountNumber: 'ALB-001',
        contactName: 'Carlos Rodriguez',
        phone: '555-0103',
        chainId: albertsons.id,
        paymentTerms: 'NET30',
        locations: {
          create: {
            name: 'Back Dock',
            addressLine1: '300 Kendall Drive',
            city: 'Miami',
            state: 'FL',
            zip: '33156',
            latitude: 25.6862,
            longitude: -80.3117,
            receivingHoursStart: '06:00',
            receivingHoursEnd: '15:00',
            dexLocationCode: 'ALB890',
          },
        },
      },
    }),
    prisma.customer.upsert({
      where: { accountNumber: 'IND-001' },
      update: {},
      create: {
        name: "Joe's Corner Market",
        accountNumber: 'IND-001',
        contactName: 'Joe Martinez',
        phone: '555-0104',
        chainId: independent.id,
        paymentTerms: 'COD',
        locations: {
          create: {
            name: 'Front Door',
            addressLine1: '45 NW 2nd Ave',
            city: 'Miami',
            state: 'FL',
            zip: '33128',
            latitude: 25.7743,
            longitude: -80.1962,
            receivingHoursStart: '07:00',
            receivingHoursEnd: '17:00',
          },
        },
      },
    }),
    prisma.customer.upsert({
      where: { accountNumber: 'IND-002' },
      update: {},
      create: {
        name: 'Fresh & Quick Bodega',
        accountNumber: 'IND-002',
        contactName: 'Ana Torres',
        phone: '555-0105',
        chainId: independent.id,
        paymentTerms: 'COD',
        locations: {
          create: {
            name: 'Side Entrance',
            addressLine1: '780 Brickell Ave',
            city: 'Miami',
            state: 'FL',
            zip: '33131',
            latitude: 25.7631,
            longitude: -80.1898,
            receivingHoursStart: '08:00',
            receivingHoursEnd: '16:00',
          },
        },
      },
    }),
  ]);

  // ─── Price Levels ───────────────────────────────────────────
  for (const product of products) {
    await prisma.priceLevel.upsert({
      where: { productId_levelCode_effectiveFrom: { productId: product.id, levelCode: 'RETAIL', effectiveFrom: new Date('2024-01-01') } },
      update: {},
      create: { productId: product.id, levelName: 'Retail', levelCode: 'RETAIL', price: product.basePrice, minQuantity: 1, effectiveFrom: new Date('2024-01-01') },
    });
    await prisma.priceLevel.upsert({
      where: { productId_levelCode_effectiveFrom: { productId: product.id, levelCode: 'WHOLESALE', effectiveFrom: new Date('2024-01-01') } },
      update: {},
      create: { productId: product.id, levelName: 'Wholesale', levelCode: 'WHOLESALE', price: Number((product.basePrice.toNumber() * 0.85).toFixed(4)), minQuantity: 10, effectiveFrom: new Date('2024-01-01') },
    });
    await prisma.priceLevel.upsert({
      where: { productId_levelCode_effectiveFrom: { productId: product.id, levelCode: 'VOLUME', effectiveFrom: new Date('2024-01-01') } },
      update: {},
      create: { productId: product.id, levelName: 'Volume', levelCode: 'VOLUME', price: Number((product.basePrice.toNumber() * 0.75).toFixed(4)), minQuantity: 50, effectiveFrom: new Date('2024-01-01') },
    });
  }

  // ─── Warehouse Inventory ────────────────────────────────────
  for (const product of products) {
    await prisma.warehouseInventory.upsert({
      where: { productId_lotNumber: { productId: product.id, lotNumber: '' } },
      update: { quantity: 500 },
      create: { productId: product.id, quantity: 500, lotNumber: '' },
    });
  }

  // ─── Promotions ─────────────────────────────────────────────
  await prisma.promotion.upsert({
    where: { id: 'promo-bogo-chips' },
    update: {},
    create: {
      id: 'promo-bogo-chips',
      name: 'Buy 2 Get 1 Free Chips',
      type: 'BOGO',
      buyQuantity: 2,
      getQuantity: 1,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2026-12-31'),
      items: { create: { productId: products[3].id, isBuyItem: true } },
    },
  });

  await prisma.promotion.upsert({
    where: { id: 'promo-10off-beverages' },
    update: {},
    create: {
      id: 'promo-10off-beverages',
      name: '10% Off All Beverages',
      type: 'PERCENTAGE_OFF',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      chainId: kroger.id,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2026-12-31'),
      items: {
        create: [
          { productId: products[0].id, isBuyItem: true },
          { productId: products[1].id, isBuyItem: true },
          { productId: products[2].id, isBuyItem: true },
        ],
      },
    },
  });

  console.log('Seed complete!');
  console.log(`Created ${products.length} products, ${customers.length} customers, 4 chains, 2 promotions`);
  console.log('Login credentials: admin@olmosdsd.com / password123, driver@olmosdsd.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
