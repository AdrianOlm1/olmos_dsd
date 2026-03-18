import prisma from '../config/db';
import { subDays, startOfDay, endOfDay, format, differenceInDays } from 'date-fns';

export class AnalyticsService {
  // ─── Dashboard Overview ───────────────────────────────────────

  async getDashboardMetrics(dateRange: { start: Date; end: Date }) {
    const { start, end } = dateRange;

    const [
      revenue,
      invoiceCount,
      avgOrderValue,
      collections,
      activeDrivers,
      activeCustomers,
      topProducts,
      pendingCredits,
    ] = await Promise.all([
      // Total revenue
      prisma.invoice.aggregate({
        where: { createdAt: { gte: start, lte: end }, status: { not: 'VOIDED' } },
        _sum: { totalAmount: true },
      }),
      // Invoice count
      prisma.invoice.count({
        where: { createdAt: { gte: start, lte: end }, status: { not: 'VOIDED' } },
      }),
      // Avg order value
      prisma.invoice.aggregate({
        where: { createdAt: { gte: start, lte: end }, status: { not: 'VOIDED' } },
        _avg: { totalAmount: true },
      }),
      // Total collections
      prisma.payment.aggregate({
        where: { collectedAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      // Active drivers
      prisma.invoice.groupBy({
        by: ['driverId'],
        where: { createdAt: { gte: start, lte: end } },
      }),
      // Active customers
      prisma.invoice.groupBy({
        by: ['customerId'],
        where: { createdAt: { gte: start, lte: end } },
      }),
      // Top products by revenue
      prisma.invoiceLine.groupBy({
        by: ['productId'],
        where: { invoice: { createdAt: { gte: start, lte: end }, status: { not: 'VOIDED' } } },
        _sum: { lineTotal: true, quantity: true },
        orderBy: { _sum: { lineTotal: 'desc' } },
        take: 10,
      }),
      // Pending credits
      prisma.creditMemo.aggregate({
        where: { status: 'PENDING' },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    // Get product names for top products
    const productIds = topProducts.map(tp => tp.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    return {
      revenue: revenue._sum.totalAmount?.toNumber() || 0,
      invoiceCount,
      avgOrderValue: avgOrderValue._avg.totalAmount?.toNumber() || 0,
      totalCollected: collections._sum.amount?.toNumber() || 0,
      activeDriverCount: activeDrivers.length,
      activeCustomerCount: activeCustomers.length,
      pendingCredits: {
        count: pendingCredits._count,
        amount: pendingCredits._sum.totalAmount?.toNumber() || 0,
      },
      topProducts: topProducts.map(tp => ({
        productId: tp.productId,
        name: productMap.get(tp.productId)?.name || 'Unknown',
        sku: productMap.get(tp.productId)?.sku || '',
        revenue: tp._sum.lineTotal?.toNumber() || 0,
        unitsSold: tp._sum.quantity?.toNumber() || 0,
      })),
    };
  }

  // ─── Revenue Trend ────────────────────────────────────────────

  async getRevenueTrend(days = 30) {
    const start = startOfDay(subDays(new Date(), days));
    const invoices = await prisma.invoice.findMany({
      where: { createdAt: { gte: start }, status: { not: 'VOIDED' } },
      select: { createdAt: true, totalAmount: true },
      orderBy: { createdAt: 'asc' },
    });

    const dailyRevenue = new Map<string, number>();
    for (let d = 0; d <= days; d++) {
      const dateKey = format(subDays(new Date(), days - d), 'yyyy-MM-dd');
      dailyRevenue.set(dateKey, 0);
    }

    for (const inv of invoices) {
      const dateKey = format(inv.createdAt, 'yyyy-MM-dd');
      dailyRevenue.set(dateKey, (dailyRevenue.get(dateKey) || 0) + inv.totalAmount.toNumber());
    }

    return Array.from(dailyRevenue.entries()).map(([date, revenue]) => ({ date, revenue }));
  }

  // ─── Customer Analytics ───────────────────────────────────────

  async getCustomerAnalytics(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { locations: true, chain: true },
    });
    if (!customer) throw new Error('Customer not found');

    const [
      orderStats,
      recentInvoices,
      topProducts,
      creditHistory,
      monthlyTrend,
    ] = await Promise.all([
      // Order stats
      prisma.invoice.aggregate({
        where: { customerId, status: { not: 'VOIDED' } },
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
        _count: true,
      }),
      // Recent invoices
      prisma.invoice.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { lines: { include: { product: true } }, payments: true },
      }),
      // Top products for this customer
      prisma.invoiceLine.groupBy({
        by: ['productId'],
        where: { invoice: { customerId, status: { not: 'VOIDED' } } },
        _sum: { lineTotal: true, quantity: true },
        _count: true,
        orderBy: { _sum: { lineTotal: 'desc' } },
        take: 20,
      }),
      // Credit history
      prisma.creditMemo.findMany({
        where: { customerId },
        include: { lines: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // Monthly revenue trend
      prisma.orderHistory.findMany({
        where: { customerId, orderDate: { gte: subDays(new Date(), 365) } },
        select: { orderDate: true, totalAmount: true },
        orderBy: { orderDate: 'asc' },
      }),
    ]);

    // Calculate order frequency
    const firstOrder = await prisma.invoice.findFirst({
      where: { customerId, status: { not: 'VOIDED' } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    const lastOrder = await prisma.invoice.findFirst({
      where: { customerId, status: { not: 'VOIDED' } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const orderCount = orderStats._count;
    let avgDaysBetweenOrders: number | null = null;
    if (firstOrder && lastOrder && orderCount > 1) {
      const totalDays = differenceInDays(lastOrder.createdAt, firstOrder.createdAt);
      avgDaysBetweenOrders = totalDays / (orderCount - 1);
    }

    // Calculate churn risk
    let churnRisk = 0;
    if (lastOrder && avgDaysBetweenOrders) {
      const daysSinceLastOrder = differenceInDays(new Date(), lastOrder.createdAt);
      churnRisk = Math.min(1, daysSinceLastOrder / (avgDaysBetweenOrders * 3));
    }

    // Get product names
    const productIds = topProducts.map(tp => tp.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    // Generate suggested products (products commonly bought by similar customers but not this one)
    const suggestedProducts = await this.getSuggestedProducts(customerId, customer.chainId);

    // Update customer insights
    await prisma.customerInsight.upsert({
      where: { customerId },
      create: {
        customerId,
        avgOrderValue: orderStats._avg.totalAmount?.toNumber(),
        avgOrderFrequencyDays: avgDaysBetweenOrders,
        lastOrderDate: lastOrder?.createdAt,
        totalLifetimeValue: orderStats._sum.totalAmount?.toNumber(),
        orderCount,
        churnRisk,
        topProducts: topProducts.slice(0, 5).map(tp => ({
          productId: tp.productId,
          name: productMap.get(tp.productId)?.name,
          revenue: tp._sum.lineTotal?.toNumber(),
        })),
        suggestedProducts,
      },
      update: {
        avgOrderValue: orderStats._avg.totalAmount?.toNumber(),
        avgOrderFrequencyDays: avgDaysBetweenOrders,
        lastOrderDate: lastOrder?.createdAt,
        totalLifetimeValue: orderStats._sum.totalAmount?.toNumber(),
        orderCount,
        churnRisk,
        topProducts: topProducts.slice(0, 5).map(tp => ({
          productId: tp.productId,
          name: productMap.get(tp.productId)?.name,
          revenue: tp._sum.lineTotal?.toNumber(),
        })),
        suggestedProducts,
      },
    });

    return {
      customer,
      stats: {
        lifetimeValue: orderStats._sum.totalAmount?.toNumber() || 0,
        avgOrderValue: orderStats._avg.totalAmount?.toNumber() || 0,
        totalOrders: orderCount,
        avgDaysBetweenOrders,
        churnRisk,
        lastOrderDate: lastOrder?.createdAt,
      },
      recentInvoices,
      topProducts: topProducts.map(tp => ({
        ...productMap.get(tp.productId),
        revenue: tp._sum.lineTotal?.toNumber() || 0,
        unitsSold: tp._sum.quantity?.toNumber() || 0,
        orderCount: tp._count,
      })),
      creditHistory,
      monthlyTrend,
      suggestedProducts,
    };
  }

  private async getSuggestedProducts(customerId: string, chainId: string | null) {
    // Find products that similar customers (same chain) buy but this customer doesn't
    if (!chainId) return [];

    const customerProducts = await prisma.invoiceLine.findMany({
      where: { invoice: { customerId } },
      select: { productId: true },
      distinct: ['productId'],
    });
    const customerProductIds = new Set(customerProducts.map(p => p.productId));

    const chainPopularProducts = await prisma.invoiceLine.groupBy({
      by: ['productId'],
      where: {
        invoice: {
          customer: { chainId },
          customerId: { not: customerId },
          status: { not: 'VOIDED' },
        },
      },
      _sum: { lineTotal: true },
      _count: true,
      orderBy: { _count: { productId: 'desc' } },
      take: 20,
    });

    const suggestions = chainPopularProducts
      .filter(p => !customerProductIds.has(p.productId))
      .slice(0, 5);

    const productIds = suggestions.map(s => s.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    return suggestions.map(s => ({
      productId: s.productId,
      name: productMap.get(s.productId)?.name || 'Unknown',
      reason: 'Popular with similar stores in your chain',
      chainPurchaseCount: s._count,
      confidence: Math.min(0.95, s._count / 50),
    }));
  }

  // ─── Driver Performance ───────────────────────────────────────

  async getDriverPerformance(driverId: string, days = 30) {
    const start = startOfDay(subDays(new Date(), days));

    const [dailyStats, routeHistory] = await Promise.all([
      prisma.driverPerformance.findMany({
        where: { driverId, date: { gte: start } },
        orderBy: { date: 'asc' },
      }),
      prisma.route.findMany({
        where: { driverId, routeDate: { gte: start } },
        include: {
          stops: true,
          invoices: { select: { totalAmount: true, status: true } },
        },
        orderBy: { routeDate: 'asc' },
      }),
    ]);

    const totalRevenue = dailyStats.reduce((sum, d) => sum + d.totalRevenue.toNumber(), 0);
    const totalStops = dailyStats.reduce((sum, d) => sum + d.stopsCompleted, 0);
    const totalSkipped = dailyStats.reduce((sum, d) => sum + d.stopsSkipped, 0);
    const totalInvoices = dailyStats.reduce((sum, d) => sum + d.invoiceCount, 0);

    return {
      summary: {
        totalRevenue,
        totalStops,
        totalSkipped,
        totalInvoices,
        avgRevenuePerDay: dailyStats.length > 0 ? totalRevenue / dailyStats.length : 0,
        avgStopsPerDay: dailyStats.length > 0 ? totalStops / dailyStats.length : 0,
        completionRate: totalStops + totalSkipped > 0 ? totalStops / (totalStops + totalSkipped) : 0,
      },
      dailyStats,
      routeHistory,
    };
  }

  // ─── Inventory Alerts ─────────────────────────────────────────

  async getInventoryAlerts() {
    const lowStock = await prisma.warehouseInventory.findMany({
      where: { quantity: { lt: 10 } },
      include: { product: true },
      orderBy: { quantity: 'asc' },
    });

    const expiringSoon = await prisma.warehouseInventory.findMany({
      where: {
        expirationDate: {
          lte: subDays(new Date(), -7), // Within 7 days
          gte: new Date(),
        },
      },
      include: { product: true },
      orderBy: { expirationDate: 'asc' },
    });

    return { lowStock, expiringSoon };
  }
}

export const analyticsService = new AnalyticsService();
