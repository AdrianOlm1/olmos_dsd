import prisma from '../config/db';
import { pricingService } from './pricing.service';
import { AppError } from '../middleware/errorHandler';
import { v4 as uuid } from 'uuid';

interface CreateInvoiceInput {
  customerId: string;
  locationId?: string;
  driverId: string;
  routeId?: string;
  lines: {
    productId: string;
    quantity: number;
    lotNumber?: string;
    expirationDate?: Date;
    overridePrice?: number;
  }[];
  notes?: string;
  deviceId?: string;
  localId?: string;
}

export class InvoiceService {
  async create(input: CreateInvoiceInput) {
    // Dedup check for offline sync
    if (input.localId && input.deviceId) {
      const existing = await prisma.invoice.findFirst({
        where: { localId: input.localId, deviceId: input.deviceId },
      });
      if (existing) return existing;
    }

    const invoiceNumber = await this.generateInvoiceNumber();

    // Resolve prices for all lines
    const lineData = await Promise.all(
      input.lines.map(async (line) => {
        const price = line.overridePrice
          ? { effectivePrice: line.overridePrice, unitPrice: line.overridePrice, source: 'base' as const }
          : await pricingService.resolvePrice(line.productId, input.customerId, line.quantity);

        const lineTotal = Number((price.effectivePrice * line.quantity).toFixed(2));
        const taxAmount = 0; // Tax calculation would go here

        return {
          id: uuid(),
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: price.unitPrice,
          discount: price.unitPrice - price.effectivePrice,
          lineTotal,
          taxAmount,
          lotNumber: line.lotNumber,
          expirationDate: line.expirationDate,
          promotionId: price.promotionId,
        };
      })
    );

    const subtotal = lineData.reduce((sum, l) => sum + l.lineTotal, 0);
    const taxAmount = lineData.reduce((sum, l) => sum + l.taxAmount, 0);
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: input.customerId,
          locationId: input.locationId,
          driverId: input.driverId,
          routeId: input.routeId,
          subtotal,
          taxAmount,
          totalAmount,
          balanceDue: totalAmount,
          notes: input.notes,
          deviceId: input.deviceId,
          localId: input.localId,
          status: 'COMPLETED',
          lines: {
            createMany: { data: lineData },
          },
        },
        include: { lines: { include: { product: true } }, customer: true },
      });

      // Deduct from truck inventory
      for (const line of input.lines) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await tx.truckInventory.updateMany({
          where: {
            driverId: input.driverId,
            productId: line.productId,
            routeDate: today,
            ...(line.lotNumber ? { lotNumber: line.lotNumber } : {}),
          },
          data: {
            quantityCurrent: { decrement: line.quantity },
            quantitySold: { increment: line.quantity },
          },
        });
      }

      return inv;
    });

    // Create order history record for analytics
    await prisma.orderHistory.create({
      data: {
        customerId: input.customerId,
        orderDate: new Date(),
        totalAmount,
        itemCount: lineData.length,
        source: 'INVOICE',
        lines: {
          createMany: {
            data: lineData.map(l => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              lineTotal: l.lineTotal,
            })),
          },
        },
      },
    });

    return invoice;
  }

  async getById(id: string) {
    return prisma.invoice.findUnique({
      where: { id },
      include: {
        lines: { include: { product: true } },
        customer: true,
        location: true,
        payments: true,
      },
    });
  }

  async listByDriver(driverId: string, date?: Date) {
    const where: any = { driverId };
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }

    return prisma.invoice.findMany({
      where,
      include: { customer: true, lines: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listByCustomer(customerId: string, limit = 50) {
    return prisma.invoice.findMany({
      where: { customerId },
      include: { lines: { include: { product: true } }, payments: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listAll(params: {
    status?: string;
    search?: string;
    driverId?: string;
    days?: number;
    page?: number;
    limit?: number;
  }) {
    const { status, search, driverId, days = 30, page = 1, limit = 50 } = params;
    const where: any = {};

    if (status && status !== 'ALL') where.status = status;
    if (driverId) where.driverId = driverId;
    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      where.createdAt = { gte: since };
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, accountNumber: true } },
          driver: { include: { user: { select: { firstName: true, lastName: true } } } },
          lines: { select: { id: true } },
          payments: { select: { id: true, amount: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async markDelivered(id: string, signatureData: string, signedByName: string) {
    return prisma.invoice.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        signatureData,
        signedByName,
        deliveredAt: new Date(),
      },
    });
  }

  async markRefused(id: string, lineRefusals?: { lineId: string; reason: string }[]) {
    return prisma.$transaction(async (tx) => {
      if (lineRefusals && lineRefusals.length > 0) {
        for (const refusal of lineRefusals) {
          await tx.invoiceLine.update({
            where: { id: refusal.lineId },
            data: { refused: true, refusedReason: refusal.reason },
          });
        }

        const invoice = await tx.invoice.findUnique({
          where: { id },
          include: { lines: true },
        });
        const allRefused = invoice?.lines.every(l => l.refused);

        return tx.invoice.update({
          where: { id },
          data: { status: allRefused ? 'REFUSED' : 'PARTIALLY_REFUSED' },
          include: { lines: true },
        });
      }

      return tx.invoice.update({
        where: { id },
        data: { status: 'REFUSED' },
      });
    });
  }

  async void(id: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!invoice) throw new AppError(404, 'Invoice not found');

    return prisma.$transaction(async (tx) => {
      // Return items to truck inventory
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const line of invoice.lines) {
        await tx.truckInventory.updateMany({
          where: {
            driverId: invoice.driverId,
            productId: line.productId,
            routeDate: today,
          },
          data: {
            quantityCurrent: { increment: line.quantity.toNumber() },
            quantitySold: { decrement: line.quantity.toNumber() },
          },
        });
      }

      return tx.invoice.update({
        where: { id },
        data: { status: 'VOIDED' },
      });
    });
  }

  private async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const prefix = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const lastInvoice = await prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
    });

    const seq = lastInvoice
      ? parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0', 10) + 1
      : 1;

    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }
}

export const invoiceService = new InvoiceService();
