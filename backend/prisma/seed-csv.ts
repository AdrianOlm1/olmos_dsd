import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

interface CsvRow {
  clientId: string;
  name: string;
  zone: string;
  city: string;
  secondLastInvoiceDate: string;
  lastInvoiceDate: string;
  daysBetweenInvoices: number;
  daysSinceLastVisit: number;
  lastInvoiceQty: number;
  avgConsumption: number;
  predictedNextDate: string;
  totalUnits: number;
  totalInvoices: number;
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
}

function parseCsv(filePath: string): CsvRow[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter((l) => l.trim());
  // Skip header
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Parse CSV with quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());

    // Fields: empty, ClientId, Cliente, Zona, City, Pinultima Fac., Ultima Factura,
    // Dias Diff. Fac., Dias Ult. Visita, Cant. Ult. Fac., Promedio, Proxima Fecha,
    // Un. Tot., Fac. Tot., Monto Tot., Costo Tot., Ganancia Tot.
    if (fields.length < 17) continue;

    const parseMoney = (s: string) => parseFloat(s.replace(/[$,]/g, '')) || 0;

    rows.push({
      clientId: fields[1],
      name: fields[2],
      zone: fields[3] || 'UNASSIGNED',
      city: fields[4] || '',
      secondLastInvoiceDate: fields[5],
      lastInvoiceDate: fields[6],
      daysBetweenInvoices: parseInt(fields[7]) || 0,
      daysSinceLastVisit: parseInt(fields[8]) || 0,
      lastInvoiceQty: parseInt(fields[9]) || 0,
      avgConsumption: parseFloat(fields[10]) || 0,
      predictedNextDate: fields[11],
      totalUnits: parseInt(fields[12]) || 0,
      totalInvoices: parseInt(fields[13]) || 0,
      totalAmount: parseMoney(fields[14]),
      totalCost: parseMoney(fields[15]),
      totalProfit: parseMoney(fields[16]),
    });
  }
  return rows;
}

function stateFromCity(city: string, zone: string): string {
  const c = city.toLowerCase();
  const z = zone.toLowerCase();
  if (z.startsWith('ny')) return 'NY';
  if (z.startsWith('nj')) return 'NJ';
  if (z.startsWith('cf')) return 'FL';
  if (c.includes('ny') || c.includes('manhattan') || c.includes('bronx') || c.includes('brooklyn') || c.includes('queens') || c.includes('yonkers')) return 'NY';
  if (c.includes('nj') || c.includes('jersey')) return 'NJ';
  if (c.includes('ct')) return 'CT';
  if (c.includes('ma')) return 'MA';
  if (c.includes('ri')) return 'RI';
  return 'FL'; // Default for South Florida based customers
}

// Detect chain from customer name
function detectChain(name: string): string | null {
  const n = name.toLowerCase();
  if (n.startsWith('cvs')) return 'CVS';
  if (n.startsWith('walmart') || n.startsWith('winn dixie') || n.startsWith('winn-dixie') || n.startsWith('winndixie') || n.startsWith('fresco')) return 'WAL';
  if (n.startsWith('key food')) return 'KFD';
  if (n.startsWith('cherry valley')) return 'CHV';
  if (n.startsWith('city fresh')) return 'CFM';
  if (n.startsWith('foodtown')) return 'FTN';
  if (n.startsWith('food universe')) return 'FUM';
  if (n.startsWith('presidente')) return 'PRS';
  if (n.startsWith('ideal food')) return 'IFB';
  return null;
}

async function main() {
  console.log('Importing CSV customer data...');

  // ── Clean up previous CSV import data ──────────────────────────
  console.log('Removing previous CSV-imported data...');

  // Find all CSV-imported customers
  const csvCustomers = await prisma.customer.findMany({
    where: { accountNumber: { startsWith: 'CSV-' } },
    select: { id: true },
  });
  const csvCustomerIds = csvCustomers.map(c => c.id);

  if (csvCustomerIds.length > 0) {
    // Delete in correct order to respect foreign keys
    // 1. Invoice lines + payments (cascade from invoices)
    const csvInvoices = await prisma.invoice.findMany({
      where: { invoiceNumber: { startsWith: 'CSV-' } },
      select: { id: true },
    });
    const csvInvoiceIds = csvInvoices.map(i => i.id);

    if (csvInvoiceIds.length > 0) {
      await prisma.payment.deleteMany({ where: { invoiceId: { in: csvInvoiceIds } } });
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: csvInvoiceIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: csvInvoiceIds } } });
      console.log(`  Deleted ${csvInvoiceIds.length} invoices`);
    }

    // 2. Customer insights
    await prisma.customerInsight.deleteMany({ where: { customerId: { in: csvCustomerIds } } });

    // 3. Customer locations
    await prisma.customerLocation.deleteMany({ where: { customerId: { in: csvCustomerIds } } });

    // 4. Customers
    await prisma.customer.deleteMany({ where: { id: { in: csvCustomerIds } } });
    console.log(`  Deleted ${csvCustomerIds.length} previous CSV customers`);
  }

  // Also clean up old dispatch batches that referenced CSV data
  const oldBatches = await prisma.dispatchBatch.findMany({ select: { id: true } });
  for (const b of oldBatches) {
    await prisma.dispatchItem.deleteMany({ where: { batchId: b.id } });
  }
  await prisma.dispatchBatch.deleteMany();
  console.log('  Cleaned up dispatch batches');

  // ── Import new CSV ─────────────────────────────────────────────

  const csvPath = path.resolve(__dirname, '../../Downloads/Ventastotales  Application-2.csv');
  // Also check if it's passed as an argument
  const actualPath = process.argv[2] || csvPath;

  if (!fs.existsSync(actualPath)) {
    console.error(`CSV file not found: ${actualPath}`);
    process.exit(1);
  }

  const rows = parseCsv(actualPath);
  console.log(`Parsed ${rows.length} rows from CSV`);

  // Get existing drivers for invoice creation
  const drivers = await prisma.driver.findMany({ take: 2 });
  if (drivers.length === 0) {
    console.error('No drivers found. Run the main seed first: npm run db:seed');
    process.exit(1);
  }

  // Get a product for creating invoice history
  const product = await prisma.product.findFirst({ where: { sku: 'ICE-001' } });
  if (!product) {
    console.error('No products found. Run the main seed first: npm run db:seed');
    process.exit(1);
  }

  // Create chains for known store brands
  const chainMap = new Map<string, string>();
  const chainDefs = [
    { code: 'CVS', name: 'CVS Pharmacy' },
    { code: 'WAL', name: 'Walmart / Winn-Dixie' },
    { code: 'KFD', name: 'Key Food Supermarkets' },
    { code: 'CHV', name: 'Cherry Valley' },
    { code: 'CFM', name: 'City Fresh Market' },
    { code: 'FTN', name: 'Foodtown' },
    { code: 'FUM', name: 'Food Universe' },
    { code: 'PRS', name: 'Presidente Supermarkets' },
    { code: 'IFB', name: 'Ideal Food Basket' },
  ];

  for (const cd of chainDefs) {
    const chain = await prisma.chain.upsert({
      where: { code: cd.code },
      update: {},
      create: { name: cd.name, code: cd.code, dexSupported: false },
    });
    chainMap.set(cd.code, chain.id);
  }

  // Collect all unique zones for driver assignment later
  const allZones = new Set<string>();

  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches of 50
  for (let batch = 0; batch < rows.length; batch += 50) {
    const chunk = rows.slice(batch, batch + 50);

    for (const row of chunk) {
      try {
        const accountNumber = `CSV-${row.clientId}`;
        const zoneNormalized = row.zone.trim().toUpperCase();
        allZones.add(zoneNormalized);
        const state = stateFromCity(row.city, row.zone);
        const chainCode = detectChain(row.name);
        const chainId = chainCode ? chainMap.get(chainCode) : null;

        // Upsert customer
        const customer = await prisma.customer.upsert({
          where: { accountNumber },
          update: {
            name: row.name,
            notes: `Zone: ${zoneNormalized}`,
          },
          create: {
            name: row.name,
            accountNumber,
            notes: `Zone: ${zoneNormalized}`,
            paymentTerms: 'NET30',
            chainId: chainId || undefined,
            locations: {
              create: {
                name: row.name,
                addressLine1: row.city || 'TBD',
                city: row.city || 'Unknown',
                state,
                zip: '00000',
              },
            },
          },
          include: { locations: { take: 1 } },
        });

        const locationId = customer.locations[0]?.id;

        // Create invoice history based on CSV data
        // We'll create the last invoice and second-to-last if dates are available
        const driverId = drivers[created % drivers.length].id;

        if (row.lastInvoiceDate && row.lastInvoiceDate !== '' && locationId) {
          const lastDate = new Date(row.lastInvoiceDate);
          if (!isNaN(lastDate.getTime())) {
            // Calculate unit price from total amount and total units
            const unitPrice = row.totalUnits > 0 ? row.totalAmount / row.totalUnits : 18.0;
            const qty = Math.max(1, row.lastInvoiceQty);
            const lineTotal = Math.round(qty * unitPrice * 100) / 100;

            const invNum = `CSV-${row.clientId}-LAST`;
            const existing = await prisma.invoice.findUnique({ where: { invoiceNumber: invNum } });
            if (!existing) {
              await prisma.invoice.create({
                data: {
                  invoiceNumber: invNum,
                  customerId: customer.id,
                  locationId,
                  driverId,
                  status: 'DELIVERED',
                  subtotal: lineTotal,
                  taxAmount: 0,
                  totalAmount: lineTotal,
                  balanceDue: 0,
                  amountPaid: lineTotal,
                  deliveredAt: lastDate,
                  createdAt: lastDate,
                  lines: {
                    create: {
                      productId: product.id,
                      quantity: qty,
                      unitPrice: Math.round(unitPrice * 100) / 100,
                      discount: 0,
                      lineTotal,
                    },
                  },
                  payments: {
                    create: { amount: lineTotal, method: 'ON_ACCOUNT', createdAt: lastDate },
                  },
                },
              });
            }

            // Create second-to-last invoice if available
            if (row.secondLastInvoiceDate && row.secondLastInvoiceDate !== '') {
              const prevDate = new Date(row.secondLastInvoiceDate);
              if (!isNaN(prevDate.getTime())) {
                const prevInvNum = `CSV-${row.clientId}-PREV`;
                const prevExisting = await prisma.invoice.findUnique({ where: { invoiceNumber: prevInvNum } });
                if (!prevExisting) {
                  const prevLineTotal = Math.round(qty * unitPrice * 100) / 100;
                  await prisma.invoice.create({
                    data: {
                      invoiceNumber: prevInvNum,
                      customerId: customer.id,
                      locationId,
                      driverId,
                      status: 'DELIVERED',
                      subtotal: prevLineTotal,
                      taxAmount: 0,
                      totalAmount: prevLineTotal,
                      balanceDue: 0,
                      amountPaid: prevLineTotal,
                      deliveredAt: prevDate,
                      createdAt: prevDate,
                      lines: {
                        create: {
                          productId: product.id,
                          quantity: qty,
                          unitPrice: Math.round(unitPrice * 100) / 100,
                          discount: 0,
                          lineTotal: prevLineTotal,
                        },
                      },
                      payments: {
                        create: { amount: prevLineTotal, method: 'ON_ACCOUNT', createdAt: prevDate },
                      },
                    },
                  });
                }
              }
            }
          }
        }

        // Upsert customer insights
        const avgFreq = row.daysBetweenInvoices > 0 ? row.daysBetweenInvoices : 30;
        await prisma.customerInsight.upsert({
          where: { customerId: customer.id },
          update: {
            orderCount: row.totalInvoices,
            totalLifetimeValue: row.totalAmount,
            lastOrderDate: row.lastInvoiceDate ? new Date(row.lastInvoiceDate) : null,
            avgOrderValue: row.totalInvoices > 0 ? row.totalAmount / row.totalInvoices : 0,
            avgOrderFrequencyDays: avgFreq,
          },
          create: {
            customerId: customer.id,
            orderCount: row.totalInvoices,
            totalLifetimeValue: row.totalAmount,
            lastOrderDate: row.lastInvoiceDate ? new Date(row.lastInvoiceDate) : null,
            avgOrderValue: row.totalInvoices > 0 ? row.totalAmount / row.totalInvoices : 0,
            avgOrderFrequencyDays: avgFreq,
            churnRisk: row.daysSinceLastVisit > 180 ? 0.8 : row.daysSinceLastVisit > 90 ? 0.4 : 0.1,
          },
        });

        created++;
      } catch (err: any) {
        errors++;
        if (errors <= 5) {
          console.error(`Error on row ${row.clientId} (${row.name}): ${err.message}`);
        }
      }
    }

    process.stdout.write(`\rProcessed ${Math.min(batch + 50, rows.length)}/${rows.length}...`);
  }

  console.log(`\n\nImport complete!`);
  console.log(`  Customers created/updated: ${created}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Unique zones: ${[...allZones].sort().join(', ')}`);

  // Show zone summary
  const zoneCounts = new Map<string, number>();
  for (const row of rows) {
    const z = row.zone.trim().toUpperCase();
    zoneCounts.set(z, (zoneCounts.get(z) || 0) + 1);
  }
  console.log('\nZone breakdown:');
  [...zoneCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([zone, count]) => console.log(`  ${zone}: ${count} customers`));
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
