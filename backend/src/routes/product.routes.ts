import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { pricingService } from '../services/pricing.service';
import prisma from '../config/db';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  const { search, categoryId, active } = req.query;
  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { sku: { contains: search as string, mode: 'insensitive' } },
      { upc: { contains: search as string, mode: 'insensitive' } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (active !== undefined) where.isActive = active === 'true';

  const products = await prisma.product.findMany({
    where,
    include: { category: true },
    orderBy: { name: 'asc' },
  });
  res.json(products);
});

router.get('/:id', async (req: Request, res: Response) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: { category: true, priceLevels: { where: { isActive: true } } },
  });
  if (!product) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(product);
});

// Get resolved price for a product for a specific customer
router.get('/:id/price/:customerId', async (req: Request, res: Response) => {
  try {
    const quantity = parseInt(req.query.quantity as string, 10) || 1;
    const price = await pricingService.resolvePrice(req.params.id, req.params.customerId, quantity);
    res.json(price);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk price resolution for a customer's catalog
router.post('/prices/bulk', async (req: Request, res: Response) => {
  try {
    const { productIds, customerId } = req.body;
    const prices = await pricingService.resolveBulkPrices(productIds, customerId);
    res.json(Object.fromEntries(prices));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories/list', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json(categories);
});

const createProductSchema = z.object({
  sku: z.string().min(1),
  upc: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  unitOfMeasure: z.string().default('EACH'),
  unitsPerCase: z.number().int().default(1),
  weight: z.number().optional(),
  basePrice: z.number().positive(),
  costPrice: z.number().positive(),
  taxable: z.boolean().default(true),
  perishable: z.boolean().default(false),
  lotTracked: z.boolean().default(false),
});

router.post('/', authorize('ADMIN', 'MANAGER'), validate(createProductSchema), async (req: Request, res: Response) => {
  try {
    const product = await prisma.product.create({
      data: req.body,
      include: { category: true },
    });
    res.status(201).json(product);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
