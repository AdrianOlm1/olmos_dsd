import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { creditService } from '../services/credit.service';

const router = Router();
router.use(authenticate);

const createCreditSchema = z.object({
  customerId: z.string().uuid(),
  driverId: z.string().uuid().optional(),
  reason: z.enum(['DAMAGED_IN_TRANSIT', 'EXPIRED_PRODUCT', 'WRONG_PRODUCT', 'CUSTOMER_RETURN', 'PRICING_ERROR', 'QUALITY_ISSUE', 'OTHER']),
  notes: z.string().optional(),
  signatureData: z.string().optional(),
  lines: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    condition: z.enum(['RESALABLE', 'DAMAGED', 'EXPIRED', 'DISPOSAL']),
    lotNumber: z.string().optional(),
  })).min(1),
  deviceId: z.string().optional(),
  localId: z.string().optional(),
});

router.post('/', validate(createCreditSchema), async (req: Request, res: Response) => {
  try {
    const credit = await creditService.create(req.body);
    res.status(201).json(credit);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/customer/:customerId', async (req: Request, res: Response) => {
  const credits = await creditService.listByCustomer(req.params.customerId);
  res.json(credits);
});

router.get('/pending', authorize('ADMIN', 'MANAGER'), async (_req: Request, res: Response) => {
  const credits = await creditService.listPending();
  res.json(credits);
});

router.post('/:id/approve', authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const credit = await creditService.approve(req.params.id);
    res.json(credit);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

export default router;
