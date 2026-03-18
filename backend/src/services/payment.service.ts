import prisma from '../config/db';
import { PaymentMethod } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

interface CollectPaymentInput {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  checkNumber?: string;
  reference?: string;
  deviceId?: string;
  localId?: string;
}

export class PaymentService {
  async collect(input: CollectPaymentInput) {
    // Dedup check
    if (input.localId && input.deviceId) {
      const existing = await prisma.payment.findFirst({
        where: { localId: input.localId, deviceId: input.deviceId },
      });
      if (existing) return existing;
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: input.invoiceId } });
    if (!invoice) throw new AppError(404, 'Invoice not found');

    if (input.amount > invoice.balanceDue.toNumber()) {
      throw new AppError(400, `Payment amount exceeds balance due of ${invoice.balanceDue}`);
    }

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: input.invoiceId,
          amount: input.amount,
          method: input.method,
          checkNumber: input.checkNumber,
          reference: input.reference,
          deviceId: input.deviceId,
          localId: input.localId,
        },
      });

      const newAmountPaid = invoice.amountPaid.toNumber() + input.amount;
      const newBalanceDue = invoice.totalAmount.toNumber() - newAmountPaid;

      await tx.invoice.update({
        where: { id: input.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          balanceDue: Math.max(0, newBalanceDue),
        },
      });

      return payment;
    });
  }

  async listByInvoice(invoiceId: string) {
    return prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { collectedAt: 'desc' },
    });
  }

  async getDriverCollections(driverId: string, date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const payments = await prisma.payment.findMany({
      where: {
        invoice: { driverId },
        collectedAt: { gte: start, lte: end },
      },
      include: { invoice: { select: { invoiceNumber: true, customerId: true } } },
    });

    const summary = {
      totalCash: 0,
      totalChecks: 0,
      totalOnAccount: 0,
      total: 0,
      payments,
    };

    for (const p of payments) {
      const amt = p.amount.toNumber();
      summary.total += amt;
      if (p.method === 'CASH') summary.totalCash += amt;
      else if (p.method === 'CHECK') summary.totalChecks += amt;
      else summary.totalOnAccount += amt;
    }

    return summary;
  }
}

export const paymentService = new PaymentService();
