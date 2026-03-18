import prisma from '../config/db';
import logger from '../config/logger';
import { invoiceService } from './invoice.service';
import { paymentService } from './payment.service';
import { creditService } from './credit.service';

interface SyncPayload {
  deviceId: string;
  lastSyncTimestamp: string; // ISO string
  invoices: any[];
  payments: any[];
  credits: any[];
  deliveryLogs: any[];
  truckInventoryUpdates: any[];
}

interface SyncResponse {
  serverTimestamp: string;
  results: {
    invoices: { localId: string; serverId: string; status: 'created' | 'duplicate' | 'error'; error?: string }[];
    payments: { localId: string; serverId: string; status: 'created' | 'duplicate' | 'error'; error?: string }[];
    credits: { localId: string; serverId: string; status: 'created' | 'duplicate' | 'error'; error?: string }[];
  };
  updates: {
    customers: any[];
    products: any[];
    priceLevels: any[];
    promotions: any[];
    routes: any[];
    truckInventory: any[];
  };
}

export class SyncService {
  /**
   * Main sync endpoint - handles bidirectional sync from driver devices.
   *
   * Strategy:
   * 1. Process incoming data from device (invoices, payments, credits, logs)
   * 2. Use localId + deviceId for idempotent dedup (offline-safe)
   * 3. Return any server-side updates since lastSyncTimestamp
   * 4. Conflict resolution: device data wins for field-created records,
   *    server data wins for admin-managed data (customers, products, prices)
   */
  async processSync(userId: string, payload: SyncPayload): Promise<SyncResponse> {
    const lastSync = new Date(payload.lastSyncTimestamp);
    const serverTimestamp = new Date().toISOString();

    const results: SyncResponse['results'] = {
      invoices: [],
      payments: [],
      credits: [],
    };

    // Process invoices
    for (const inv of payload.invoices) {
      try {
        const created = await invoiceService.create({
          customerId: inv.customerId,
          locationId: inv.locationId,
          driverId: inv.driverId,
          routeId: inv.routeId,
          lines: inv.lines,
          notes: inv.notes,
          deviceId: payload.deviceId,
          localId: inv.localId,
        });

        // If the invoice already existed, it's a duplicate
        const isDuplicate = await prisma.invoice.findFirst({
          where: { localId: inv.localId, deviceId: payload.deviceId, id: { not: created.id } },
        });

        results.invoices.push({
          localId: inv.localId,
          serverId: created.id,
          status: isDuplicate ? 'duplicate' : 'created',
        });

        // Handle signature if provided
        if (inv.signatureData && inv.signedByName) {
          await invoiceService.markDelivered(created.id, inv.signatureData, inv.signedByName);
        }

        await prisma.syncLog.create({
          data: {
            userId,
            deviceId: payload.deviceId,
            direction: 'DEVICE_TO_SERVER',
            entityType: 'invoice',
            entityId: created.id,
            status: 'SUCCESS',
          },
        });
      } catch (err: any) {
        results.invoices.push({
          localId: inv.localId,
          serverId: '',
          status: 'error',
          error: err.message,
        });

        await prisma.syncLog.create({
          data: {
            userId,
            deviceId: payload.deviceId,
            direction: 'DEVICE_TO_SERVER',
            entityType: 'invoice',
            entityId: inv.localId,
            status: 'FAILED',
            errorMessage: err.message,
          },
        });
      }
    }

    // Process payments
    for (const pmt of payload.payments) {
      try {
        const created = await paymentService.collect({
          invoiceId: pmt.invoiceId,
          amount: pmt.amount,
          method: pmt.method,
          checkNumber: pmt.checkNumber,
          reference: pmt.reference,
          deviceId: payload.deviceId,
          localId: pmt.localId,
        });

        results.payments.push({
          localId: pmt.localId,
          serverId: created.id,
          status: 'created',
        });
      } catch (err: any) {
        results.payments.push({
          localId: pmt.localId,
          serverId: '',
          status: 'error',
          error: err.message,
        });
      }
    }

    // Process credits
    for (const cr of payload.credits) {
      try {
        const created = await creditService.create({
          customerId: cr.customerId,
          driverId: cr.driverId,
          reason: cr.reason,
          notes: cr.notes,
          signatureData: cr.signatureData,
          lines: cr.lines,
          deviceId: payload.deviceId,
          localId: cr.localId,
        });

        results.credits.push({
          localId: cr.localId,
          serverId: created.id,
          status: 'created',
        });
      } catch (err: any) {
        results.credits.push({
          localId: cr.localId,
          serverId: '',
          status: 'error',
          error: err.message,
        });
      }
    }

    // Process delivery logs
    for (const log of payload.deliveryLogs) {
      try {
        await prisma.deliveryLog.create({
          data: {
            driverId: log.driverId,
            locationId: log.locationId,
            action: log.action,
            metadata: log.metadata,
            latitude: log.latitude,
            longitude: log.longitude,
            deviceId: payload.deviceId,
            createdAt: new Date(log.createdAt),
          },
        });
      } catch (err) {
        logger.warn('Failed to sync delivery log', { error: err });
      }
    }

    // Gather server-side updates to send to device
    const updates = await this.getUpdatesForDevice(lastSync);

    return { serverTimestamp, results, updates };
  }

  private async getUpdatesForDevice(since: Date): Promise<SyncResponse['updates']> {
    const [customers, products, promotions, routes] = await Promise.all([
      prisma.customer.findMany({
        where: { updatedAt: { gt: since } },
        include: { locations: true, chain: true },
      }),
      prisma.product.findMany({
        where: { updatedAt: { gt: since }, isActive: true },
        include: { category: true },
      }),
      prisma.promotion.findMany({
        where: {
          updatedAt: { gt: since },
          isActive: true,
          endDate: { gte: new Date() },
        },
        include: { items: true },
      }),
      prisma.route.findMany({
        where: { updatedAt: { gt: since } },
        include: { stops: { include: { location: { include: { customer: true } } } } },
      }),
    ]);

    // Get updated price levels
    const priceLevels = await prisma.priceLevel.findMany({
      where: { updatedAt: { gt: since }, isActive: true },
    });

    const customerPriceLevels = await prisma.customerPriceLevel.findMany({
      where: { createdAt: { gt: since }, isActive: true },
    });

    return {
      customers,
      products,
      priceLevels: [...priceLevels, ...customerPriceLevels],
      promotions,
      routes,
      truckInventory: [],
    };
  }
}

export const syncService = new SyncService();
