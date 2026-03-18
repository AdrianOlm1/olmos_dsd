import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { dexService } from '../services/dex.service';

const router = Router();
router.use(authenticate);

router.post('/generate/:invoiceId', async (req: Request, res: Response) => {
  try {
    const dexData = await dexService.generateDEX(req.params.invoiceId);
    res.json({ dexData });
  } catch (err: any) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/transmitted/:invoiceId', async (req: Request, res: Response) => {
  try {
    await dexService.markTransmitted(req.params.invoiceId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/acknowledged/:invoiceId', async (req: Request, res: Response) => {
  try {
    await dexService.markAcknowledged(req.params.invoiceId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/chains', async (_req: Request, res: Response) => {
  const chains = await dexService.getSupportedChains();
  res.json(chains);
});

export default router;
