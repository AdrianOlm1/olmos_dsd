import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paymentService } from '../services/payment.service';

const router = Router();
router.use(authenticate);

const collectPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['CASH', 'CHECK', 'ON_ACCOUNT']),
  checkNumber: z.string().optional(),
  reference: z.string().optional(),
  deviceId: z.string().optional(),
  localId: z.string().optional(),
});

router.post('/', validate(collectPaymentSchema), async (req: Request, res: Response) => {
  try {
    const payment = await paymentService.collect(req.body);
    res.status(201).json(payment);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/invoice/:invoiceId', async (req: Request, res: Response) => {
  const payments = await paymentService.listByInvoice(req.params.invoiceId);
  res.json(payments);
});

router.get('/driver/:driverId/collections', async (req: Request, res: Response) => {
  const date = req.query.date ? new Date(req.query.date as string) : new Date();
  const collections = await paymentService.getDriverCollections(req.params.driverId, date);
  res.json(collections);
});

export default router;
