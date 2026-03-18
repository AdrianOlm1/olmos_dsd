import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import prisma from '../config/db';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  const { search, chainId, active } = req.query;
  const where: any = {};

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { accountNumber: { contains: search as string, mode: 'insensitive' } },
    ];
  }
  if (chainId) where.chainId = chainId;
  if (active !== undefined) where.isActive = active === 'true';

  const customers = await prisma.customer.findMany({
    where,
    include: { locations: true, chain: true, customerInsights: true },
    orderBy: { name: 'asc' },
  });
  res.json(customers);
});

router.get('/:id', async (req: Request, res: Response) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params.id },
    include: {
      locations: true,
      chain: true,
      customerInsights: true,
      priceLevels: { include: { product: true } },
    },
  });
  if (!customer) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(customer);
});

const createCustomerSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  accountNumber: z.string().optional(),
  taxExempt: z.boolean().default(false),
  paymentTerms: z.string().default('NET30'),
  chainId: z.string().uuid().optional(),
  creditLimit: z.number().optional(),
  notes: z.string().optional(),
  locations: z.array(z.object({
    name: z.string(),
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    deliveryNotes: z.string().optional(),
    receivingHoursStart: z.string().optional(),
    receivingHoursEnd: z.string().optional(),
    dexLocationCode: z.string().optional(),
  })).optional(),
});

router.post('/', authorize('ADMIN', 'MANAGER'), validate(createCustomerSchema), async (req: Request, res: Response) => {
  try {
    const { locations, ...data } = req.body;
    const customer = await prisma.customer.create({
      data: {
        ...data,
        ...(locations ? { locations: { createMany: { data: locations } } } : {}),
      },
      include: { locations: true, chain: true },
    });
    res.status(201).json(customer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: req.body,
      include: { locations: true, chain: true },
    });
    res.json(customer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
