import cron from 'node-cron';
import prisma from '../config/db';
import { quickbooksService } from '../services/quickbooks.service';
import logger from '../config/logger';

/**
 * Background job that syncs pending records to QuickBooks Online.
 * Runs every 5 minutes to respect QBO rate limits (500 requests/min).
 * Processes in small batches to avoid overwhelming the API.
 */
export function startQBOSyncJob() {
  // Every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('QBO sync job starting...');

    try {
      const connectionStatus = await quickbooksService.getConnectionStatus();
      if (!connectionStatus.connected || connectionStatus.isExpired) {
        logger.warn('QBO not connected or token expired, skipping sync');
        return;
      }

      // Sync invoices (batch of 10)
      const pendingInvoices = await prisma.invoice.findMany({
        where: { qboSyncStatus: 'PENDING', status: { not: 'VOIDED' } },
        take: 10,
        orderBy: { createdAt: 'asc' },
      });

      for (const invoice of pendingInvoices) {
        try {
          await quickbooksService.syncInvoiceToQBO(invoice.id);
          logger.info(`Synced invoice ${invoice.invoiceNumber} to QBO`);
        } catch (err) {
          logger.error(`Failed to sync invoice ${invoice.invoiceNumber}`, { error: err });
        }
        // Rate limit: wait 200ms between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Sync payments (batch of 10)
      const pendingPayments = await prisma.payment.findMany({
        where: { qboSyncStatus: 'PENDING' },
        take: 10,
        orderBy: { createdAt: 'asc' },
      });

      for (const payment of pendingPayments) {
        try {
          await quickbooksService.syncPaymentToQBO(payment.id);
          logger.info(`Synced payment ${payment.id} to QBO`);
        } catch (err) {
          logger.error(`Failed to sync payment ${payment.id}`, { error: err });
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      logger.info(`QBO sync complete: ${pendingInvoices.length} invoices, ${pendingPayments.length} payments processed`);
    } catch (err) {
      logger.error('QBO sync job failed', { error: err });
    }
  });

  logger.info('QBO sync job scheduled (every 5 minutes)');
}

/**
 * Background job to compute customer insights nightly.
 * Runs at 2:00 AM every day.
 */
export function startInsightsJob() {
  cron.schedule('0 2 * * *', async () => {
    logger.info('Customer insights job starting...');

    try {
      const customers = await prisma.customer.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      const { analyticsService } = await import('../services/analytics.service');

      for (const customer of customers) {
        try {
          await analyticsService.getCustomerAnalytics(customer.id);
        } catch (err) {
          logger.warn(`Failed to compute insights for customer ${customer.id}`, { error: err });
        }
      }

      logger.info(`Customer insights computed for ${customers.length} customers`);
    } catch (err) {
      logger.error('Customer insights job failed', { error: err });
    }
  });

  logger.info('Customer insights job scheduled (daily at 2:00 AM)');
}

/**
 * Background job to compute daily driver performance metrics.
 * Runs at 11:00 PM every day.
 */
export function startDriverPerformanceJob() {
  cron.schedule('0 23 * * *', async () => {
    logger.info('Driver performance job starting...');

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const drivers = await prisma.driver.findMany({
        include: { user: true },
      });

      for (const driver of drivers) {
        const [invoices, routes, payments] = await Promise.all([
          prisma.invoice.findMany({
            where: { driverId: driver.id, createdAt: { gte: today, lte: endOfDay } },
          }),
          prisma.route.findFirst({
            where: { driverId: driver.id, routeDate: today },
            include: { stops: true },
          }),
          prisma.payment.aggregate({
            where: { invoice: { driverId: driver.id }, collectedAt: { gte: today, lte: endOfDay } },
            _sum: { amount: true },
          }),
        ]);

        const stopsCompleted = routes?.stops.filter(s => s.status === 'COMPLETED').length || 0;
        const stopsSkipped = routes?.stops.filter(s => ['SKIPPED', 'NO_SERVICE'].includes(s.status)).length || 0;
        const totalRevenue = invoices.reduce((sum, inv) => sum + inv.totalAmount.toNumber(), 0);

        await prisma.driverPerformance.upsert({
          where: { driverId_date: { driverId: driver.id, date: today } },
          create: {
            driverId: driver.id,
            date: today,
            stopsCompleted,
            stopsSkipped,
            totalRevenue,
            totalCollected: payments._sum.amount?.toNumber() || 0,
            invoiceCount: invoices.length,
          },
          update: {
            stopsCompleted,
            stopsSkipped,
            totalRevenue,
            totalCollected: payments._sum.amount?.toNumber() || 0,
            invoiceCount: invoices.length,
          },
        });
      }

      logger.info(`Driver performance computed for ${drivers.length} drivers`);
    } catch (err) {
      logger.error('Driver performance job failed', { error: err });
    }
  });

  logger.info('Driver performance job scheduled (daily at 11:00 PM)');
}
