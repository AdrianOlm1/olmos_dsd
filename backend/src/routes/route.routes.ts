import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { routeService } from '../services/route.service';

const router = Router();
router.use(authenticate);

const createRouteSchema = z.object({
  name: z.string().min(1),
  driverId: z.string().uuid(),
  routeDate: z.string().transform(v => new Date(v)),
  stops: z.array(z.object({
    locationId: z.string().uuid(),
    stopOrder: z.number().int().positive(),
    plannedArrival: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  })).min(1),
});

router.post('/', authorize('ADMIN', 'MANAGER', 'DISPATCHER'), validate(createRouteSchema), async (req: Request, res: Response) => {
  try {
    const route = await routeService.create(req.body);
    res.status(201).json(route);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/driver/:driverId', async (req: Request, res: Response) => {
  const date = req.query.date ? new Date(req.query.date as string) : undefined;
  const route = await routeService.getDriverRoute(req.params.driverId, date);
  res.json(route);
});

router.get('/driver/:driverId/history', async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
  const routes = await routeService.getRouteHistory(req.params.driverId, limit);
  res.json(routes);
});

router.get('/active', authorize('ADMIN', 'MANAGER', 'DISPATCHER'), async (_req: Request, res: Response) => {
  const routes = await routeService.getActiveRoutes();
  res.json(routes);
});

router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const route = await routeService.startRoute(req.params.id);
    res.json(route);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/:id/stops/:stopId/arrive', async (req: Request, res: Response) => {
  const stop = await routeService.arriveAtStop(req.params.id, req.params.stopId);
  res.json(stop);
});

router.post('/:id/stops/:stopId/complete', async (req: Request, res: Response) => {
  const stop = await routeService.completeStop(req.params.id, req.params.stopId, req.body.notes);
  res.json(stop);
});

router.post('/:id/stops/:stopId/skip', async (req: Request, res: Response) => {
  const stop = await routeService.skipStop(req.params.id, req.params.stopId, req.body.reason);
  res.json(stop);
});

router.post('/:id/complete', async (req: Request, res: Response) => {
  const route = await routeService.completeRoute(req.params.id);
  res.json(route);
});

export default router;
