import prisma from '../config/db';
import { CreditReason, ReturnCondition } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

interface CreateCreditInput {
  customerId: string;
  driverId?: string;
  reason: CreditReason;
  notes?: string;
  signatureData?: string;
  lines: {
    productId: string;
    quantity: number;
    unitPrice: number;
    condition: ReturnCondition;
    lotNumber?: string;
  }[];
  deviceId?: string;
  localId?: string;
}

export class CreditService {
  async create(input: CreateCreditInput) {
    // Dedup check
    if (input.localId && input.deviceId) {
      const existing = await prisma.creditMemo.findFirst({
        where: { localId: input.localId, deviceId: input.deviceId },
      });
      if (existing) return existing;
    }

    const creditNumber = await this.generateCreditNumber();

    const lineData = input.lines.map(line => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: Number((line.quantity * line.unitPrice).toFixed(2)),
      condition: line.condition,
      lotNumber: line.lotNumber,
    }));

    const totalAmount = lineData.reduce((sum, l) => sum + l.lineTotal, 0);

    return prisma.$transaction(async (tx) => {
      const credit = await tx.creditMemo.create({
        data: {
          creditNumber,
          customerId: input.customerId,
          driverId: input.driverId,
          reason: input.reason,
          totalAmount,
          notes: input.notes,
          signatureData: input.signatureData,
          deviceId: input.deviceId,
          localId: input.localId,
          lines: { createMany: { data: lineData } },
        },
        include: { lines: { include: { product: true } }, customer: true },
      });

      // Handle returned inventory based on condition
      if (input.driverId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const line of input.lines) {
          // Add back to truck inventory
          await tx.truckInventory.updateMany({
            where: {
              driverId: input.driverId,
              productId: line.productId,
              routeDate: today,
            },
            data: {
              quantityReturned: { increment: line.quantity },
              // Only add to current if resalable
              ...(line.condition === 'RESALABLE'
                ? { quantityCurrent: { increment: line.quantity } }
                : {}),
            },
          });
        }
      }

      return credit;
    });
  }

  async approve(id: string) {
    return prisma.creditMemo.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  }

  async listByCustomer(customerId: string) {
    return prisma.creditMemo.findMany({
      where: { customerId },
      include: { lines: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPending() {
    return prisma.creditMemo.findMany({
      where: { status: 'PENDING' },
      include: { customer: true, lines: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async generateCreditNumber(): Promise<string> {
    const today = new Date();
    const prefix = `CR-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const last = await prisma.creditMemo.findFirst({
      where: { creditNumber: { startsWith: prefix } },
      orderBy: { creditNumber: 'desc' },
    });
    const seq = last ? parseInt(last.creditNumber.split('-').pop() || '0', 10) + 1 : 1;
    return `${prefix}-${String(seq).padStart(4, '0')}`;
  }
}

export const creditService = new CreditService();
