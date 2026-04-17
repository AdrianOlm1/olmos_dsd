import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

function demoDateDaysAgo(ref: Date, days: number): Date {
  const d = new Date(ref);
  d.setDate(d.getDate() - days);
  d.setHours(14, 30, 0, 0);
  return d;
}

/** Delivered invoices with payment so auto-dispatch scoring has real history (ice cream + staples). */
async function seedDeliveredInvoice(
  invoiceNumber: string,
  customerId: string,
  locationId: string,
  driverId: string,
  deliveredAt: Date,
  lines: { productId: string; quantity: number; unitPrice: number }[],
) {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 100) / 100;
  const total = subtotal;
  await prisma.invoice.upsert({
    where: { invoiceNumber },
    update: {
      deliveredAt,
      createdAt: deliveredAt,
    },
    create: {
      invoiceNumber,
      customerId,
      locationId,
      driverId,
      status: 'DELIVERED',
      subtotal,
      taxAmount: 0,
      totalAmount: total,
      balanceDue: 0,
      amountPaid: total,
      deliveredAt,
      createdAt: deliveredAt,
      lines: {
        create: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: 0,
          lineTotal: Math.round(l.quantity * l.unitPrice * 100) / 100,
        })),
      },
      payments: {
        create: { amount: total, method: 'CASH' },
      },
    },
  });
}

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
    // Ice cream route-DSD demo SKUs (from route / auto-dispatch use case)
    prisma.product.upsert({ where: { sku: 'ICE-001' }, update: {}, create: { sku: 'ICE-001', upc: '088012340001', name: 'Ice Cream 3gal Tub Chocolate', categoryId: frozen.id, basePrice: 48.99, costPrice: 28.00, unitOfMeasure: 'CASE', unitsPerCase: 1, perishable: true, lotTracked: true } }),
    prisma.product.upsert({ where: { sku: 'ICE-002' }, update: {}, create: { sku: 'ICE-002', upc: '088012340002', name: 'Ice Cream 3gal Tub Vanilla', categoryId: frozen.id, basePrice: 48.99, costPrice: 28.00, unitOfMeasure: 'CASE', unitsPerCase: 1, perishable: true, lotTracked: true } }),
    prisma.product.upsert({ where: { sku: 'ICE-003' }, update: {}, create: { sku: 'ICE-003', upc: '088012340003', name: 'Novelty Ice Cream Bars 24ct', categoryId: frozen.id, basePrice: 32.50, costPrice: 18.25, unitOfMeasure: 'CASE', unitsPerCase: 24, perishable: true } }),
    prisma.product.upsert({ where: { sku: 'ICE-004' }, update: {}, create: { sku: 'ICE-004', upc: '088012340004', name: 'Ice Cream Sandwiches 30ct', categoryId: frozen.id, basePrice: 36.00, costPrice: 20.00, unitOfMeasure: 'CASE', unitsPerCase: 30, perishable: true } }),
  ]);

  // ─── Customers ──────────────────────────────────────────────
  const customers = await Promise.all([
    prisma.customer.upsert({
      where: { accountNumber: 'KRG-001' },
      update: {},
      create: {
        name: 'Kroger #1234 - Downtown',
        accountNumber: 'KRG-001',
        notes: 'Zone: A',
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
        notes: 'Zone: B',
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
        notes: 'Zone: NY 4',
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
        notes: 'Zone: 6A',
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
        notes: 'Zone: CF2',
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

  // ─── Driver zones (matches `Zone: …` in customer notes for auto-dispatch) ───
  const mikeDriverId = driverUser.driver?.id;
  const sarahDriverId = driver2User.driver?.id;
  if (!mikeDriverId || !sarahDriverId) throw new Error('Seed requires driver profiles for Mike and Sarah');

  await prisma.driverZone.deleteMany({
    where: { driverId: { in: [mikeDriverId, sarahDriverId] } },
  });
  await prisma.driverZone.createMany({
    data: [
      { driverId: mikeDriverId, zone: 'A', isPrimary: true },
      { driverId: mikeDriverId, zone: 'NY 4', isPrimary: false },
      { driverId: sarahDriverId, zone: 'B', isPrimary: true },
      { driverId: sarahDriverId, zone: '6A', isPrimary: false },
      { driverId: sarahDriverId, zone: 'CF2', isPrimary: false },
    ],
  });

  // ─── Demo route / ice-cream invoice history (zones + visit spacing for scoring) ───
  const p = (sku: string) => {
    const pr = products.find((x) => x.sku === sku);
    if (!pr) throw new Error(`Missing product ${sku}`);
    return pr;
  };

  const ref = new Date();
  ref.setHours(12, 0, 0, 0);

  const routed = await prisma.customer.findMany({
    where: { accountNumber: { in: ['KRG-001', 'PBX-001', 'ALB-001', 'IND-001', 'IND-002'] } },
    include: { locations: { where: { isActive: true }, take: 1 } },
  });
  const loc = (accountNumber: string) => {
    const c = routed.find((x) => x.accountNumber === accountNumber);
    const lid = c?.locations[0]?.id;
    if (!c || !lid) throw new Error(`Missing location for ${accountNumber}`);
    return { customerId: c.id, locationId: lid };
  };

  const krg = loc('KRG-001');
  await seedDeliveredInvoice('DEMO-KRG-2025a', krg.customerId, krg.locationId, mikeDriverId, demoDateDaysAgo(ref, 52), [
    { productId: p('ICE-001').id, quantity: 4, unitPrice: 48.99 },
    { productId: p('BEV-001').id, quantity: 10, unitPrice: 4.99 },
  ]);
  await seedDeliveredInvoice('DEMO-KRG-2025b', krg.customerId, krg.locationId, mikeDriverId, demoDateDaysAgo(ref, 28), [
    { productId: p('ICE-002').id, quantity: 6, unitPrice: 48.99 },
    { productId: p('ICE-003').id, quantity: 3, unitPrice: 32.5 },
  ]);
  await seedDeliveredInvoice('DEMO-KRG-2025c', krg.customerId, krg.locationId, sarahDriverId, demoDateDaysAgo(ref, 7), [
    { productId: p('ICE-001').id, quantity: 12, unitPrice: 48.99 },
    { productId: p('ICE-004').id, quantity: 5, unitPrice: 36.0 },
  ]);

  const pbx = loc('PBX-001');
  await seedDeliveredInvoice('DEMO-PBX-2025a', pbx.customerId, pbx.locationId, sarahDriverId, demoDateDaysAgo(ref, 58), [
    { productId: p('ICE-002').id, quantity: 5, unitPrice: 48.99 },
  ]);
  await seedDeliveredInvoice('DEMO-PBX-2025b', pbx.customerId, pbx.locationId, sarahDriverId, demoDateDaysAgo(ref, 31), [
    { productId: p('ICE-003').id, quantity: 8, unitPrice: 32.5 },
    { productId: p('SNK-001').id, quantity: 12, unitPrice: 3.49 },
  ]);
  await seedDeliveredInvoice('DEMO-PBX-2025c', pbx.customerId, pbx.locationId, mikeDriverId, demoDateDaysAgo(ref, 9), [
    { productId: p('ICE-001').id, quantity: 10, unitPrice: 48.99 },
  ]);

  const alb = loc('ALB-001');
  await seedDeliveredInvoice('DEMO-ALB-2025a', alb.customerId, alb.locationId, mikeDriverId, demoDateDaysAgo(ref, 102), [
    { productId: p('ICE-002').id, quantity: 7, unitPrice: 48.99 },
  ]);
  await seedDeliveredInvoice('DEMO-ALB-2025b', alb.customerId, alb.locationId, mikeDriverId, demoDateDaysAgo(ref, 48), [
    { productId: p('ICE-001').id, quantity: 9, unitPrice: 48.99 },
    { productId: p('ICE-004').id, quantity: 6, unitPrice: 36.0 },
  ]);

  const ind1 = loc('IND-001');
  await seedDeliveredInvoice('DEMO-IND1-2025a', ind1.customerId, ind1.locationId, sarahDriverId, demoDateDaysAgo(ref, 41), [
    { productId: p('ICE-003').id, quantity: 6, unitPrice: 32.5 },
  ]);
  await seedDeliveredInvoice('DEMO-IND1-2025b', ind1.customerId, ind1.locationId, sarahDriverId, demoDateDaysAgo(ref, 19), [
    { productId: p('ICE-001').id, quantity: 4, unitPrice: 48.99 },
  ]);
  await seedDeliveredInvoice('DEMO-IND1-2025c', ind1.customerId, ind1.locationId, mikeDriverId, demoDateDaysAgo(ref, 4), [
    { productId: p('ICE-002').id, quantity: 14, unitPrice: 48.99 },
    { productId: p('ICE-004').id, quantity: 4, unitPrice: 36.0 },
  ]);

  const ind2 = loc('IND-002');
  await seedDeliveredInvoice('DEMO-IND2-2025a', ind2.customerId, ind2.locationId, sarahDriverId, demoDateDaysAgo(ref, 118), [
    { productId: p('ICE-001').id, quantity: 3, unitPrice: 48.99 },
  ]);
  await seedDeliveredInvoice('DEMO-IND2-2025b', ind2.customerId, ind2.locationId, mikeDriverId, demoDateDaysAgo(ref, 68), [
    { productId: p('ICE-002').id, quantity: 5, unitPrice: 48.99 },
    { productId: p('ICE-003').id, quantity: 4, unitPrice: 32.5 },
  ]);

  // Optional insights row for dashboards
  for (const c of routed) {
    const invs = await prisma.invoice.findMany({
      where: { customerId: c.id },
      orderBy: { createdAt: 'desc' },
    });
    const total = invs.reduce((s, i) => s + Number(i.totalAmount), 0);
    await prisma.customerInsight.upsert({
      where: { customerId: c.id },
      update: {
        orderCount: invs.length,
        totalLifetimeValue: total,
        lastOrderDate: invs[0]?.createdAt ?? null,
        avgOrderValue: invs.length ? total / invs.length : 0,
        avgOrderFrequencyDays: 28,
      },
      create: {
        customerId: c.id,
        orderCount: invs.length,
        totalLifetimeValue: total,
        lastOrderDate: invs[0]?.createdAt ?? null,
        avgOrderValue: invs.length ? total / invs.length : 0,
        avgOrderFrequencyDays: 28,
        churnRisk: 0.15,
      },
    });
  }

  const demoInvoiceCount = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: 'DEMO-' } },
  });

  console.log('Seed complete!');
  console.log(`Created ${products.length} products, ${customers.length} customers, 4 chains, 2 promotions`);
  console.log(
    `Demo route data: ICE-* products, zones (A, B, NY 4, 6A, CF2), driver–zone assignments, ${demoInvoiceCount} DEMO-* delivered invoices for auto-dispatch.`,
  );
  console.log('Login credentials: admin@olmosdsd.com / password123, driver@olmosdsd.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
