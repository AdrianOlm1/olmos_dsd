import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';

interface LoadTruckInput {
  driverId: string;
  items: {
    productId: string;
    quantity: number;
    lotNumber?: string;
    expirationDate?: Date;
  }[];
  routeDate?: Date;
}

export class InventoryService {
  async loadTruck(input: LoadTruckInput) {
    const routeDate = input.routeDate || new Date();
    routeDate.setHours(0, 0, 0, 0);

    return prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of input.items) {
        // Check warehouse availability
        const warehouse = await tx.warehouseInventory.findFirst({
          where: {
            productId: item.productId,
            ...(item.lotNumber ? { lotNumber: item.lotNumber } : {}),
          },
        });

        if (!warehouse || warehouse.quantity.toNumber() < item.quantity) {
          throw new AppError(400,
            `Insufficient warehouse stock for product ${item.productId}. ` +
            `Available: ${warehouse?.quantity.toNumber() || 0}, Requested: ${item.quantity}`
          );
        }

        // Deduct from warehouse
        await tx.warehouseInventory.update({
          where: { id: warehouse.id },
          data: { quantity: { decrement: item.quantity } },
        });

        // Add to truck (upsert to handle reloads)
        const truckItem = await tx.truckInventory.upsert({
          where: {
            driverId_productId_routeDate_lotNumber: {
              driverId: input.driverId,
              productId: item.productId,
              routeDate,
              lotNumber: item.lotNumber || '',
            },
          },
          create: {
            driverId: input.driverId,
            productId: item.productId,
            quantityLoaded: item.quantity,
            quantityCurrent: item.quantity,
            lotNumber: item.lotNumber,
            expirationDate: item.expirationDate,
            routeDate,
          },
          update: {
            quantityLoaded: { increment: item.quantity },
            quantityCurrent: { increment: item.quantity },
          },
        });

        results.push(truckItem);
      }

      return results;
    });
  }

  async getTruckInventory(driverId: string, routeDate?: Date) {
    const date = routeDate || new Date();
    date.setHours(0, 0, 0, 0);

    return prisma.truckInventory.findMany({
      where: { driverId, routeDate: date },
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
    });
  }

  async getWarehouseInventory(filters?: { categoryId?: string; lowStock?: boolean }) {
    const where: any = {};

    if (filters?.categoryId) {
      where.product = { categoryId: filters.categoryId };
    }

    const inventory = await prisma.warehouseInventory.findMany({
      where,
      include: { product: { include: { category: true } } },
      orderBy: { product: { name: 'asc' } },
    });

    if (filters?.lowStock) {
      // Flag items where current stock is below 20% of a reasonable threshold
      return inventory.filter(i => i.quantity.toNumber() < 10);
    }

    return inventory;
  }

  async reconcileTruckEnd(driverId: string, routeDate?: Date) {
    const date = routeDate || new Date();
    date.setHours(0, 0, 0, 0);

    const truckItems = await prisma.truckInventory.findMany({
      where: { driverId, routeDate: date },
      include: { product: true },
    });

    const summary = {
      totalLoaded: 0,
      totalSold: 0,
      totalReturned: 0,
      totalRemaining: 0,
      discrepancies: [] as { productId: string; productName: string; expected: number; actual: number }[],
      items: truckItems.map(item => ({
        productId: item.productId,
        productName: item.product.name,
        loaded: item.quantityLoaded.toNumber(),
        sold: item.quantitySold.toNumber(),
        returned: item.quantityReturned.toNumber(),
        current: item.quantityCurrent.toNumber(),
        expected: item.quantityLoaded.toNumber() - item.quantitySold.toNumber() - item.quantityReturned.toNumber(),
      })),
    };

    for (const item of summary.items) {
      summary.totalLoaded += item.loaded;
      summary.totalSold += item.sold;
      summary.totalReturned += item.returned;
      summary.totalRemaining += item.current;

      if (Math.abs(item.current - item.expected) > 0.001) {
        summary.discrepancies.push({
          productId: item.productId,
          productName: item.productName,
          expected: item.expected,
          actual: item.current,
        });
      }
    }

    return summary;
  }

  async returnToWarehouse(driverId: string, items: { productId: string; quantity: number; lotNumber?: string }[]) {
    return prisma.$transaction(async (tx) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const item of items) {
        // Update truck inventory
        await tx.truckInventory.updateMany({
          where: {
            driverId,
            productId: item.productId,
            routeDate: today,
            ...(item.lotNumber ? { lotNumber: item.lotNumber } : {}),
          },
          data: {
            quantityCurrent: { decrement: item.quantity },
            quantityReturned: { increment: item.quantity },
          },
        });

        // Return to warehouse
        await tx.warehouseInventory.upsert({
          where: {
            productId_lotNumber: {
              productId: item.productId,
              lotNumber: item.lotNumber || '',
            },
          },
          create: {
            productId: item.productId,
            quantity: item.quantity,
            lotNumber: item.lotNumber,
          },
          update: {
            quantity: { increment: item.quantity },
          },
        });
      }
    });
  }
}

export const inventoryService = new InventoryService();
