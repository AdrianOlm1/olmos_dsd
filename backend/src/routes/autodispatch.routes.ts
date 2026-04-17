import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { autoDispatchService } from '../services/autodispatch.service';

const router = Router();
router.use(authenticate);

// ── Settings ────────────────────────────────────────────────────

router.get('/settings', authorize('ADMIN', 'MANAGER', 'DISPATCHER'), async (_req: Request, res: Response) => {
  try {
    const settings = await autoDispatchService.getSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

const updateSettingsSchema = z.object({
  autoApprove: z.boolean().optional(),
  preselectByDefault: z.boolean().optional(),
  urgencyThreshold: z.number().int().min(0).max(100).optional(),
  overdueWeight: z.number().min(0).max(1).optional(),
  consumptionWeight: z.number().min(0).max(1).optional(),
  revenueWeight: z.number().min(0).max(1).optional(),
  daysSinceVisitWeight: z.number().min(0).max(1).optional(),
});

router.put('/settings', authorize('ADMIN', 'MANAGER'), validate(updateSettingsSchema), async (req: Request, res: Response) => {
  try {
    const settings = await autoDispatchService.updateSettings(req.body);
    res.json(settings);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ── Driver Zones ────────────────────────────────────────────────

router.get('/driver-zones', authorize('ADMIN', 'MANAGER', 'DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId as string | undefined;
    const zones = await autoDispatchService.getDriverZones(driverId);
    res.json(zones);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

const assignZonesSchema = z.object({
  driverId: z.string().uuid(),
  zones: z.array(z.object({
    zone: z.string().min(1),
    isPrimary: z.boolean().optional(),
  })),
});

router.post('/driver-zones', authorize('ADMIN', 'MANAGER'), validate(assignZonesSchema), async (req: Request, res: Response) => {
  try {
    const result = await autoDispatchService.assignDriverZones(req.body.driverId, req.body.zones);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ── Scoring ─────────────────────────────────────────────────────

router.get('/scores', authorize('ADMIN', 'MANAGER', 'DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : undefined;
    const scores = await autoDispatchService.scoreCustomers(date);
    res.json(scores);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/summary', authorize('ADMIN', 'MANAGER', 'DISPATCHER'), async (_req: Request, res: Response) => {
  try {
    const summary = await autoDispatchService.getDispatchSummary();
    res.json(summary);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ── Suggestions (habit-weighted, manual-first) ──────────────────

router.get('/suggestions', authorize('ADMIN', 'MANAGER', 'DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const date = req.query.date ? new Date(req.query.date as string) : undefined;
    const userId = req.user!.userId;
    const scores = await autoDispatchService.scoreCustomersForUser(userId, date);
    res.json(scores);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/affinity', authorize('ADMIN', 'MANAGER', 'DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const map = await autoDispatchService.getAffinityMap(userId);
    res.json(map);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

const recordSelectionsSchema = z.object({
  items: z.array(z.object({
    customerId: z.string(),
    batchId: z.string().optional(),
    urgencyScore: z.number().min(0).max(100),
    selected: z.boolean(),
    zone: z.string().optional(),
  })),
});

router.post('/selections', authorize('ADMIN', 'MANAGER', 'DISPATCHER'), validate(recordSelectionsSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const result = await autoDispatchService.recordSelections(userId, req.body.items);
    res.json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ── Batch Management ────────────────────────────────────────────

const generateBatchSchema = z.object({
  dispatchDate: z.string().transform(v => new Date(v)),
  zones: z.array(z.string()).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
});

router.post('/generate', authorize('ADMIN', 'MANAGER', 'DISPATCHER'), validate(generateBatchSchema), async (req: Request, res: Response) => {
  try {
    const batch = await autoDispatchService.generateBatch({
      dispatchDate: req.body.dispatchDate,
      createdById: req.user!.userId,
      zones: req.body.zones,
      minScore: req.body.minScore,
    });
    res.status(201).json(batch);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/batches', authorize('ADMIN', 'MANAGER', 'DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const batches = await autoDispatchService.listBatches(limit);
    res.json(batches);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/batches/:id', authorize('ADMIN', 'MANAGER', 'DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const batch = await autoDispatchService.getBatch(req.params.id);
    res.json(batch);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.patch('/batches/:batchId/items/:itemId', authorize('ADMIN', 'MANAGER', 'DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const { batchId, itemId } = req.params;
    if (typeof req.body.selected === 'boolean') {
      const item = await autoDispatchService.updateItemSelection(batchId, itemId, req.body.selected);
      return res.json(item);
    }
    if (req.body.assignedDriverId) {
      const item = await autoDispatchService.updateItemDriver(batchId, itemId, req.body.assignedDriverId);
      return res.json(item);
    }
    res.status(400).json({ error: 'Provide selected or assignedDriverId' });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/batches/:id/approve', authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const batch = await autoDispatchService.approveBatch(req.params.id, req.user!.userId);
    res.json(batch);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/batches/:id/cancel', authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const batch = await autoDispatchService.cancelBatch(req.params.id);
    res.json(batch);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

export default router;
