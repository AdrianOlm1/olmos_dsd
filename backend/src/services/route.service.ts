import prisma from '../config/db';
import { AppError } from '../middleware/errorHandler';

interface CreateRouteInput {
  name: string;
  driverId: string;
  routeDate: Date;
  stops: {
    locationId: string;
    stopOrder: number;
    plannedArrival?: Date;
  }[];
}

export class RouteService {
  async create(input: CreateRouteInput) {
    return prisma.route.create({
      data: {
        name: input.name,
        driverId: input.driverId,
        routeDate: input.routeDate,
        totalStops: input.stops.length,
        stops: {
          createMany: {
            data: input.stops.map(s => ({
              locationId: s.locationId,
              stopOrder: s.stopOrder,
              plannedArrival: s.plannedArrival,
            })),
          },
        },
      },
      include: {
        stops: { include: { location: { include: { customer: true } } }, orderBy: { stopOrder: 'asc' } },
        driver: { include: { user: true } },
      },
    });
  }

  async getDriverRoute(driverId: string, date?: Date) {
    const routeDate = date || new Date();
    routeDate.setHours(0, 0, 0, 0);

    return prisma.route.findFirst({
      where: { driverId, routeDate },
      include: {
        stops: {
          include: { location: { include: { customer: true } } },
          orderBy: { stopOrder: 'asc' },
        },
      },
    });
  }

  async startRoute(routeId: string) {
    return prisma.route.update({
      where: { id: routeId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
  }

  async arriveAtStop(routeId: string, stopId: string) {
    return prisma.routeStop.update({
      where: { id: stopId },
      data: { status: 'IN_PROGRESS', actualArrival: new Date() },
    });
  }

  async completeStop(routeId: string, stopId: string, notes?: string) {
    const stop = await prisma.routeStop.update({
      where: { id: stopId },
      data: { status: 'COMPLETED', departedAt: new Date(), notes },
    });

    await prisma.route.update({
      where: { id: routeId },
      data: { completedStops: { increment: 1 } },
    });

    return stop;
  }

  async skipStop(routeId: string, stopId: string, reason: string) {
    const stop = await prisma.routeStop.update({
      where: { id: stopId },
      data: { status: 'NO_SERVICE', noServiceReason: reason },
    });

    return stop;
  }

  async completeRoute(routeId: string) {
    return prisma.route.update({
      where: { id: routeId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  async getActiveRoutes() {
    return prisma.route.findMany({
      where: { status: 'IN_PROGRESS' },
      include: {
        driver: { include: { user: true } },
        stops: { include: { location: true }, orderBy: { stopOrder: 'asc' } },
      },
    });
  }

  async getRouteHistory(driverId: string, limit = 30) {
    return prisma.route.findMany({
      where: { driverId },
      include: {
        stops: { include: { location: { include: { customer: true } } } },
        invoices: { select: { id: true, totalAmount: true, status: true } },
      },
      orderBy: { routeDate: 'desc' },
      take: limit,
    });
  }
}

export const routeService = new RouteService();
