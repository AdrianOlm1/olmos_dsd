import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';
import { routeService } from './route.service';
import { Decimal } from '@prisma/client/runtime/library';

interface ScoreWeights {
  overdueWeight: number;
  consumptionWeight: number;
  revenueWeight: number;
  daysSinceVisitWeight: number;
}

interface CustomerScore {
  customerId: string;
  customerName: string;
  zone: string;
  city: string;
  locationId: string | null;
  urgencyScore: number;
  urgencyLevel: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';
  daysSinceLastVisit: number;
  avgConsumption: number;
  lastInvoiceDate: Date | null;
  predictedNextDate: Date | null;
  lastInvoiceQty: number;
  totalRevenue: number;
  totalProfit: number;
}

export class AutoDispatchService {

  // ── Settings ──────────────────────────────────────────────────

  async getSettings() {
    let settings = await prisma.autoDispatchSettings.findFirst();
    if (!settings) {
      settings = await prisma.autoDispatchSettings.create({
        data: {
          autoApprove: false,
          urgencyThreshold: 60,
          overdueWeight: 0.40,
          consumptionWeight: 0.25,
          revenueWeight: 0.20,
          daysSinceVisitWeight: 0.15,
        },
      });
    }
    return settings;
  }

  async updateSettings(data: {
    autoApprove?: boolean;
    urgencyThreshold?: number;
    overdueWeight?: number;
    consumptionWeight?: number;
    revenueWeight?: number;
    daysSinceVisitWeight?: number;
  }) {
    const current = await this.getSettings();
    return prisma.autoDispatchSettings.update({
      where: { id: current.id },
      data,
    });
  }

  // ── Driver Zone Management ────────────────────────────────────

  async getDriverZones(driverId?: string) {
    const where = driverId ? { driverId } : {};
    return prisma.driverZone.findMany({
      where,
      include: { driver: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: [{ zone: 'asc' }, { isPrimary: 'desc' }],
    });
  }

  async assignDriverZones(driverId: string, zones: { zone: string; isPrimary?: boolean }[]) {
    // Remove existing zones for this driver and replace
    await prisma.driverZone.deleteMany({ where: { driverId } });
    if (zones.length === 0) return [];

    return prisma.driverZone.createManyAndReturn({
      data: zones.map(z => ({
        driverId,
        zone: z.zone.toUpperCase().trim(),
        isPrimary: z.isPrimary ?? false,
      })),
    });
  }

  async getDriversForZone(zone: string) {
    return prisma.driverZone.findMany({
      where: { zone: zone.toUpperCase().trim() },
      include: { driver: { include: { user: { select: { id: true, firstName: true, lastName: true, isActive: true } } } } },
      orderBy: { isPrimary: 'desc' },
    });
  }

  // ── Scoring Engine ────────────────────────────────────────────

  async scoreCustomers(targetDate?: Date): Promise<CustomerScore[]> {
    const today = targetDate || new Date();
    today.setHours(0, 0, 0, 0);

    const settings = await this.getSettings();
    const weights: ScoreWeights = {
      overdueWeight: Number(settings.overdueWeight),
      consumptionWeight: Number(settings.consumptionWeight),
      revenueWeight: Number(settings.revenueWeight),
      daysSinceVisitWeight: Number(settings.daysSinceVisitWeight),
    };

    // Get all active customers with their invoice history
    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      include: {
        locations: { where: { isActive: true }, take: 1 },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            createdAt: true,
            totalAmount: true,
            lines: { select: { quantity: true } },
          },
        },
        customerInsights: true,
      },
    });

    const scores: CustomerScore[] = [];

    for (const customer of customers) {
      if (customer.invoices.length === 0) continue; // Skip customers with no history

      const lastInvoice = customer.invoices[0];
      const lastInvoiceDate = new Date(lastInvoice.createdAt);

      // Calculate days since last visit
      const daysSinceLastVisit = Math.floor(
        (today.getTime() - lastInvoiceDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate average days between invoices
      let avgDaysBetween = 30; // default
      if (customer.invoices.length >= 2) {
        const intervals: number[] = [];
        for (let i = 0; i < customer.invoices.length - 1; i++) {
          const d1 = new Date(customer.invoices[i].createdAt);
          const d2 = new Date(customer.invoices[i + 1].createdAt);
          const diff = Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
          if (diff > 0) intervals.push(diff);
        }
        if (intervals.length > 0) {
          avgDaysBetween = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
        }
      } else if (customer.customerInsights?.avgOrderFrequencyDays) {
        avgDaysBetween = Number(customer.customerInsights.avgOrderFrequencyDays);
      }

      // Predicted next visit date
      const predictedNextDate = new Date(lastInvoiceDate);
      predictedNextDate.setDate(predictedNextDate.getDate() + avgDaysBetween);

      // Days overdue (positive = overdue, negative = not yet due)
      const daysOverdue = Math.floor(
        (today.getTime() - predictedNextDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Average consumption per day (total units / total days of history)
      const totalQty = customer.invoices.reduce((sum, inv) => {
        return sum + inv.lines.reduce((s, l) => s + Number(l.quantity), 0);
      }, 0);
      const firstInvoice = customer.invoices[customer.invoices.length - 1];
      const historyDays = Math.max(1, Math.floor(
        (today.getTime() - new Date(firstInvoice.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      ));
      const avgConsumption = totalQty / historyDays;

      // Last invoice quantity
      const lastInvoiceQty = lastInvoice.lines.reduce((s, l) => s + Number(l.quantity), 0);

      // Total revenue and estimated profit
      const totalRevenue = customer.invoices.reduce((s, inv) => s + Number(inv.totalAmount), 0);
      const totalProfit = customer.customerInsights?.totalLifetimeValue
        ? Number(customer.customerInsights.totalLifetimeValue)
        : totalRevenue * 0.65; // rough estimate if no insight

      // Determine zone from customer notes, account number, or location city
      const zone = this.extractZone(customer);

      // ── Score Calculation ──
      // 1. Overdue score (0-100): how far past predicted date
      const overdueScore = Math.min(100, Math.max(0,
        daysOverdue > 0
          ? 50 + Math.min(50, (daysOverdue / avgDaysBetween) * 50) // 50-100 if overdue
          : 50 - Math.min(50, (Math.abs(daysOverdue) / avgDaysBetween) * 50) // 0-50 if not yet due
      ));

      // 2. Consumption score (0-100): higher consumption = more urgent
      const consumptionScore = Math.min(100, avgConsumption * 200); // normalize

      // 3. Revenue score (0-100): higher revenue customers are higher priority
      const revenueScore = Math.min(100, (totalRevenue / 50000) * 100); // normalize to $50k

      // 4. Days since visit score (0-100): more days = more urgent
      const visitScore = Math.min(100, (daysSinceLastVisit / 90) * 100); // normalize to 90 days

      // Weighted final score
      const urgencyScore = Math.round(
        overdueScore * weights.overdueWeight +
        consumptionScore * weights.consumptionWeight +
        revenueScore * weights.revenueWeight +
        visitScore * weights.daysSinceVisitWeight
      );

      // Urgency level
      let urgencyLevel: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';
      if (daysOverdue > 0) urgencyLevel = 'OVERDUE';
      else if (daysOverdue > -7) urgencyLevel = 'DUE_SOON';
      else urgencyLevel = 'UPCOMING';

      scores.push({
        customerId: customer.id,
        customerName: customer.name,
        zone: zone || 'UNASSIGNED',
        city: customer.locations[0]?.city || '',
        locationId: customer.locations[0]?.id || null,
        urgencyScore: Math.min(100, Math.max(0, urgencyScore)),
        urgencyLevel,
        daysSinceLastVisit,
        avgConsumption,
        lastInvoiceDate,
        predictedNextDate,
        lastInvoiceQty: Math.round(lastInvoiceQty),
        totalRevenue,
        totalProfit,
      });
    }

    // Sort by urgency score descending
    scores.sort((a, b) => b.urgencyScore - a.urgencyScore);
    return scores;
  }

  // ── Batch Generation ──────────────────────────────────────────

  async generateBatch(input: {
    dispatchDate: Date;
    createdById: string;
    zones?: string[];
    minScore?: number;
  }) {
    const { dispatchDate, createdById, zones, minScore } = input;
    const settings = await this.getSettings();
    const threshold = minScore ?? Number(settings.urgencyThreshold);

    // Score all customers
    let scores = await this.scoreCustomers(dispatchDate);

    // Filter by zones if specified
    if (zones && zones.length > 0) {
      const upperZones = zones.map(z => z.toUpperCase().trim());
      scores = scores.filter(s => upperZones.includes(s.zone.toUpperCase()));
    }

    // Filter by minimum score
    scores = scores.filter(s => s.urgencyScore >= threshold || s.urgencyLevel === 'OVERDUE');

    if (scores.length === 0) {
      throw new AppError(404, 'No customers meet the dispatch threshold for the selected criteria');
    }

    // Get driver assignments by zone
    const allDriverZones = await prisma.driverZone.findMany({
      include: { driver: { include: { user: { select: { firstName: true, lastName: true, isActive: true } } } } },
    });

    const zoneDriverMap = new Map<string, string>();
    for (const dz of allDriverZones) {
      if (dz.driver.user.isActive && !zoneDriverMap.has(dz.zone)) {
        zoneDriverMap.set(dz.zone, dz.driverId);
      }
    }

    // Count unique zones and drivers
    const uniqueZones = new Set(scores.map(s => s.zone));
    const uniqueDrivers = new Set<string>();
    for (const zone of uniqueZones) {
      const driverId = zoneDriverMap.get(zone);
      if (driverId) uniqueDrivers.add(driverId);
    }

    // Create the batch
    const batch = await prisma.dispatchBatch.create({
      data: {
        name: `Dispatch ${dispatchDate.toISOString().split('T')[0]}`,
        dispatchDate,
        status: 'DRAFT',
        autoGenerated: true,
        createdById,
        totalStops: scores.length,
        totalDrivers: uniqueDrivers.size,
        items: {
          createMany: {
            data: scores.map(s => ({
              customerId: s.customerId,
              locationId: s.locationId,
              zone: s.zone,
              assignedDriverId: zoneDriverMap.get(s.zone) || null,
              urgencyScore: s.urgencyScore,
              urgencyLevel: s.urgencyLevel,
              daysSinceLastVisit: s.daysSinceLastVisit,
              avgConsumption: s.avgConsumption,
              lastInvoiceDate: s.lastInvoiceDate,
              predictedNextDate: s.predictedNextDate,
              lastInvoiceQty: s.lastInvoiceQty,
              totalRevenue: s.totalRevenue,
              totalProfit: s.totalProfit,
              // Manual-first: never pre-select. User must explicitly pick.
              // Preserve threshold as a "suggested" marker on the client side.
              selected: settings.preselectByDefault ? s.urgencyScore >= threshold : false,
            })),
          },
        },
      },
      include: {
        items: true,
      },
    });

    // If auto-approve is on, dispatch immediately
    if (settings.autoApprove) {
      return this.approveBatch(batch.id, createdById);
    }

    return this.getBatch(batch.id);
  }

  // ── Batch Management ──────────────────────────────────────────

  async getBatch(batchId: string) {
    const batch = await prisma.dispatchBatch.findUnique({
      where: { id: batchId },
      include: {
        items: {
          orderBy: [{ zone: 'asc' }, { urgencyScore: 'desc' }],
        },
      },
    });
    if (!batch) throw new AppError(404, 'Dispatch batch not found');

    // Enrich items with customer names and driver names
    const customerIds = batch.items.map(i => i.customerId);
    const driverIds = batch.items.filter(i => i.assignedDriverId).map(i => i.assignedDriverId!);

    const [customers, drivers] = await Promise.all([
      prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true },
      }),
      prisma.driver.findMany({
        where: { id: { in: driverIds } },
        include: { user: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    const customerMap = new Map(customers.map(c => [c.id, c.name]));
    const driverMap = new Map(drivers.map(d => [d.id, `${d.user.firstName} ${d.user.lastName}`]));

    return {
      ...batch,
      items: batch.items.map(item => ({
        ...item,
        customerName: customerMap.get(item.customerId) || 'Unknown',
        driverName: item.assignedDriverId ? driverMap.get(item.assignedDriverId) || 'Unassigned' : 'Unassigned',
      })),
    };
  }

  async listBatches(limit = 20) {
    return prisma.dispatchBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: { select: { items: true } },
      },
    });
  }

  async updateItemSelection(batchId: string, itemId: string, selected: boolean) {
    const item = await prisma.dispatchItem.findFirst({
      where: { id: itemId, batchId },
    });
    if (!item) throw new AppError(404, 'Dispatch item not found');

    return prisma.dispatchItem.update({
      where: { id: itemId },
      data: { selected },
    });
  }

  async updateItemDriver(batchId: string, itemId: string, driverId: string) {
    return prisma.dispatchItem.update({
      where: { id: itemId },
      data: { assignedDriverId: driverId },
    });
  }

  async approveBatch(batchId: string, approvedById: string) {
    const batch = await prisma.dispatchBatch.findUnique({
      where: { id: batchId },
      include: { items: { where: { selected: true } } },
    });
    if (!batch) throw new AppError(404, 'Dispatch batch not found');
    if (batch.status === 'DISPATCHED') throw new AppError(400, 'Batch already dispatched');

    // Group selected items by driver
    const driverStops = new Map<string, typeof batch.items>();
    for (const item of batch.items) {
      if (!item.assignedDriverId) continue;
      const stops = driverStops.get(item.assignedDriverId) || [];
      stops.push(item);
      driverStops.set(item.assignedDriverId, stops);
    }

    // Create routes for each driver
    const routeDate = batch.dispatchDate;
    for (const [driverId, stops] of driverStops) {
      const stopsWithLocations = stops.filter(s => s.locationId);
      if (stopsWithLocations.length === 0) continue;

      await routeService.create({
        name: `Auto-Dispatch ${routeDate.toISOString().split('T')[0]} - ${stops[0].zone}`,
        driverId,
        routeDate,
        stops: stopsWithLocations.map((s, i) => ({
          locationId: s.locationId!,
          stopOrder: i + 1,
        })),
      });
    }

    // Update batch status
    return prisma.dispatchBatch.update({
      where: { id: batchId },
      data: {
        status: 'DISPATCHED',
        approvedById,
        approvedAt: new Date(),
      },
    });
  }

  async cancelBatch(batchId: string) {
    return prisma.dispatchBatch.update({
      where: { id: batchId },
      data: { status: 'CANCELLED' },
    });
  }

  // ── Habit Learning (lightweight collaborative filtering) ──────

  /**
   * Record user selection decisions so the system can learn habits.
   * Call this whenever a user picks/skips items in a batch.
   * NEVER auto-selects for the user — this only records what they chose.
   */
  async recordSelections(userId: string, items: Array<{
    customerId: string;
    batchId?: string;
    urgencyScore: number;
    selected: boolean;
    zone?: string;
  }>) {
    if (items.length === 0) return { recorded: 0 };
    const dayOfWeek = new Date().getDay();

    // Bulk insert selection events
    await prisma.dispatchSelectionEvent.createMany({
      data: items.map(i => ({
        userId,
        customerId: i.customerId,
        batchId: i.batchId,
        urgencyScore: Math.round(i.urgencyScore),
        selected: i.selected,
        dayOfWeek,
        zone: i.zone,
      })),
    });

    // Update affinity aggregates (sequential upserts; small N per request)
    for (const i of items) {
      const existing = await prisma.userCustomerAffinity.findUnique({
        where: { userId_customerId: { userId, customerId: i.customerId } },
      });
      const pickCount = (existing?.pickCount || 0) + (i.selected ? 1 : 0);
      const skipCount = (existing?.skipCount || 0) + (i.selected ? 0 : 1);
      const total = pickCount + skipCount;
      const affinityScore = total > 0 ? pickCount / total : 0;

      await prisma.userCustomerAffinity.upsert({
        where: { userId_customerId: { userId, customerId: i.customerId } },
        create: {
          userId,
          customerId: i.customerId,
          pickCount,
          skipCount,
          lastPickedAt: i.selected ? new Date() : null,
          affinityScore,
        },
        update: {
          pickCount,
          skipCount,
          lastPickedAt: i.selected ? new Date() : existing?.lastPickedAt,
          affinityScore,
        },
      });
    }

    return { recorded: items.length };
  }

  /**
   * Return affinity map for a user: { customerId → affinityScore(0..1) }.
   * Used by the UI to show ★ markers — never to auto-select.
   */
  async getAffinityMap(userId: string): Promise<Record<string, {
    affinityScore: number;
    pickCount: number;
  }>> {
    const rows = await prisma.userCustomerAffinity.findMany({
      where: { userId },
      select: { customerId: true, affinityScore: true, pickCount: true },
    });
    const map: Record<string, { affinityScore: number; pickCount: number }> = {};
    for (const r of rows) {
      map[r.customerId] = { affinityScore: r.affinityScore, pickCount: r.pickCount };
    }
    return map;
  }

  /**
   * Score customers AND blend in the user's past-selection habits.
   * Produces a "suggestionScore" per customer but marks nothing as selected.
   * Blend: 0.5 * urgency + 0.3 * affinity + 0.2 * recency-decay
   */
  async scoreCustomersForUser(userId: string, targetDate?: Date) {
    const scores = await this.scoreCustomers(targetDate);
    const affinity = await this.getAffinityMap(userId);

    return scores.map(s => {
      const a = affinity[s.customerId];
      const affinityScore = a?.affinityScore ?? 0;
      const pickCount = a?.pickCount ?? 0;
      // Normalize pickCount into a 0..1 "familiarity" signal (log scale cap at 10)
      const familiarity = Math.min(1, Math.log10(1 + pickCount) / Math.log10(11));
      const suggestionScore = Math.round(
        0.5 * s.urgencyScore + 0.3 * (affinityScore * 100) + 0.2 * (familiarity * 100)
      );

      const reasonTags: string[] = [];
      if (s.urgencyLevel === 'OVERDUE') reasonTags.push('overdue');
      if (affinityScore >= 0.6) reasonTags.push('favorite');
      if (pickCount >= 3) reasonTags.push('frequent');
      if (s.totalRevenue >= 20000) reasonTags.push('high-revenue');

      return {
        ...s,
        suggestionScore,
        affinityScore,
        userPickCount: pickCount,
        reasonTags,
      };
    }).sort((a, b) => b.suggestionScore - a.suggestionScore);
  }

  // ── Zone Extraction ───────────────────────────────────────────

  private extractZone(customer: any): string {
    // Try to get zone from notes or account number patterns
    // The CSV data shows zones like "B", "4", "6a", "NY 4", "NJ 3", "CF2", etc.
    if (customer.notes) {
      const zoneMatch = customer.notes.match(/zone[:\s]*([A-Za-z0-9\s]+)/i);
      if (zoneMatch) return zoneMatch[1].trim().toUpperCase();
    }
    // Fall back to first location city or empty
    return customer.locations?.[0]?.state?.toUpperCase() || 'UNASSIGNED';
  }

  // ── Summary for Dashboard ─────────────────────────────────────

  async getDispatchSummary() {
    const settings = await this.getSettings();
    const scores = await this.scoreCustomers();
    const threshold = Number(settings.urgencyThreshold);

    const overdue = scores.filter(s => s.urgencyLevel === 'OVERDUE');
    const dueSoon = scores.filter(s => s.urgencyLevel === 'DUE_SOON');
    const aboveThreshold = scores.filter(s => s.urgencyScore >= threshold);

    // Group by zone
    const zoneMap = new Map<string, { count: number; overdue: number; totalRevenue: number }>();
    for (const s of scores) {
      const entry = zoneMap.get(s.zone) || { count: 0, overdue: 0, totalRevenue: 0 };
      entry.count++;
      if (s.urgencyLevel === 'OVERDUE') entry.overdue++;
      entry.totalRevenue += s.totalRevenue;
      zoneMap.set(s.zone, entry);
    }

    // Get driver coverage
    const driverZones = await prisma.driverZone.findMany({
      include: { driver: { include: { user: { select: { firstName: true, lastName: true, isActive: true } } } } },
    });
    const coveredZones = new Set(driverZones.filter(dz => dz.driver.user.isActive).map(dz => dz.zone));
    const allZones = new Set(scores.map(s => s.zone));
    const uncoveredZones = [...allZones].filter(z => !coveredZones.has(z));

    // Build drivers list with their zones
    const driverMap = new Map<string, { id: string; name: string; zones: { zone: string; isPrimary: boolean }[] }>();
    for (const dz of driverZones) {
      if (!dz.driver.user.isActive) continue;
      const existing = driverMap.get(dz.driverId);
      const zoneEntry = { zone: dz.zone, isPrimary: dz.isPrimary };
      if (existing) {
        existing.zones.push(zoneEntry);
      } else {
        driverMap.set(dz.driverId, {
          id: dz.driverId,
          name: `${dz.driver.user.firstName} ${dz.driver.user.lastName}`,
          zones: [zoneEntry],
        });
      }
    }

    // Also include drivers with no zones assigned
    const allDrivers = await prisma.driver.findMany({
      include: { user: { select: { firstName: true, lastName: true, isActive: true } } },
      where: { user: { isActive: true } },
    });
    for (const d of allDrivers) {
      if (!driverMap.has(d.id)) {
        driverMap.set(d.id, {
          id: d.id,
          name: `${d.user.firstName} ${d.user.lastName}`,
          zones: [],
        });
      }
    }

    return {
      totalCustomers: scores.length,
      overdueCount: overdue.length,
      dueSoonCount: dueSoon.length,
      readyToDispatch: aboveThreshold.length,
      autoApprove: settings.autoApprove,
      urgencyThreshold: threshold,
      zones: Object.fromEntries(zoneMap),
      uncoveredZones,
      driverCount: new Set(driverZones.filter(dz => dz.driver.user.isActive).map(dz => dz.driverId)).size,
      drivers: [...driverMap.values()],
    };
  }
}

export const autoDispatchService = new AutoDispatchService();
