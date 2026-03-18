import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { analyticsService } from '../services/analytics.service';
import { subDays } from 'date-fns';

const router = Router();
router.use(authenticate);
router.use(authorize('ADMIN', 'MANAGER', 'DISPATCHER'));

router.get('/dashboard', async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string, 10) || 30;
  const start = subDays(new Date(), days);
  const end = new Date();
  const metrics = await analyticsService.getDashboardMetrics({ start, end });
  res.json(metrics);
});

router.get('/revenue-trend', async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string, 10) || 30;
  const trend = await analyticsService.getRevenueTrend(days);
  res.json(trend);
});

router.get('/customer/:customerId', async (req: Request, res: Response) => {
  try {
    const analytics = await analyticsService.getCustomerAnalytics(req.params.customerId);
    res.json(analytics);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/driver/:driverId', async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string, 10) || 30;
  const performance = await analyticsService.getDriverPerformance(req.params.driverId, days);
  res.json(performance);
});

router.get('/inventory-alerts', async (_req: Request, res: Response) => {
  const alerts = await analyticsService.getInventoryAlerts();
  res.json(alerts);
});

export default router;
