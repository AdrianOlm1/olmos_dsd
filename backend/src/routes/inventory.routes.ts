import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { inventoryService } from '../services/inventory.service';

const router = Router();
router.use(authenticate);

const loadTruckSchema = z.object({
  driverId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    lotNumber: z.string().optional(),
    expirationDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
  })).min(1),
  routeDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
});

router.post('/truck/load', authorize('ADMIN', 'MANAGER', 'DRIVER'), validate(loadTruckSchema), async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.loadTruck(req.body);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/truck/:driverId', async (req: Request, res: Response) => {
  const date = req.query.date ? new Date(req.query.date as string) : undefined;
  const inventory = await inventoryService.getTruckInventory(req.params.driverId, date);
  res.json(inventory);
});

router.get('/truck/:driverId/reconcile', async (req: Request, res: Response) => {
  const date = req.query.date ? new Date(req.query.date as string) : undefined;
  const summary = await inventoryService.reconcileTruckEnd(req.params.driverId, date);
  res.json(summary);
});

router.post('/truck/:driverId/return', async (req: Request, res: Response) => {
  try {
    await inventoryService.returnToWarehouse(req.params.driverId, req.body.items);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/warehouse', async (req: Request, res: Response) => {
  const filters = {
    categoryId: req.query.categoryId as string | undefined,
    lowStock: req.query.lowStock === 'true',
  };
  const inventory = await inventoryService.getWarehouseInventory(filters);
  res.json(inventory);
});

export default router;
