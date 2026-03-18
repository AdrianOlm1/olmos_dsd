import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { invoiceService } from '../services/invoice.service';

const router = Router();
router.use(authenticate);

const createInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  driverId: z.string().uuid(),
  routeId: z.string().uuid().optional(),
  lines: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    lotNumber: z.string().optional(),
    expirationDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    overridePrice: z.number().positive().optional(),
  })).min(1),
  notes: z.string().optional(),
  deviceId: z.string().optional(),
  localId: z.string().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  const { status, search, driverId, days, page, limit } = req.query;
  const result = await invoiceService.listAll({
    status: status as string,
    search: search as string,
    driverId: driverId as string,
    days: days ? parseInt(days as string, 10) : undefined,
    page: page ? parseInt(page as string, 10) : undefined,
    limit: limit ? parseInt(limit as string, 10) : undefined,
  });
  res.json(result);
});

router.post('/', validate(createInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const invoice = await invoiceService.create(req.body);
    res.status(201).json(invoice);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const invoice = await invoiceService.getById(req.params.id);
  if (!invoice) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(invoice);
});

router.get('/driver/:driverId', async (req: Request, res: Response) => {
  const date = req.query.date ? new Date(req.query.date as string) : undefined;
  const invoices = await invoiceService.listByDriver(req.params.driverId, date);
  res.json(invoices);
});

router.get('/customer/:customerId', async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const invoices = await invoiceService.listByCustomer(req.params.customerId, limit);
  res.json(invoices);
});

router.post('/:id/deliver', async (req: Request, res: Response) => {
  try {
    const { signatureData, signedByName } = req.body;
    const invoice = await invoiceService.markDelivered(req.params.id, signatureData, signedByName);
    res.json(invoice);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/:id/refuse', async (req: Request, res: Response) => {
  try {
    const invoice = await invoiceService.markRefused(req.params.id, req.body.lineRefusals);
    res.json(invoice);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/:id/void', authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const invoice = await invoiceService.void(req.params.id);
    res.json(invoice);
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

export default router;
