import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { quickbooksService } from '../services/quickbooks.service';

const router = Router();

// OAuth flow (no auth required for callback)
router.get('/connect', authenticate, authorize('ADMIN'), (_req: Request, res: Response) => {
  const authUri = quickbooksService.getAuthUri();
  res.json({ authUri });
});

router.get('/callback', async (req: Request, res: Response) => {
  // Intuit redirects back with ?error= if the user denied or something went wrong upstream
  if (req.query.error) {
    const desc = req.query.error_description ? ` — ${req.query.error_description}` : '';
    return res.status(400).send(`<h3>QuickBooks connection failed: ${req.query.error}${desc}</h3><p>You can close this window.</p>`);
  }

  try {
    const result = await quickbooksService.handleCallback(req.originalUrl);
    res.send(`<h3>QuickBooks connected!</h3><p>Realm ID: ${result.realmId}</p><p>You can close this window.</p><script>window.opener && window.opener.postMessage('qbo-connected', '*'); setTimeout(() => window.close(), 2000);</script>`);
  } catch (err: any) {
    res.status(500).send(`<h3>QuickBooks connection error</h3><p>${err.message}</p><p>You can close this window.</p>`);
  }
});

router.get('/status', authenticate, async (_req: Request, res: Response) => {
  const status = await quickbooksService.getConnectionStatus();
  res.json(status);
});

router.get('/sync-status', authenticate, async (_req: Request, res: Response) => {
  const status = await quickbooksService.getSyncStatus();
  res.json(status);
});

// Manual sync triggers
router.post('/sync/invoice/:id', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const result = await quickbooksService.syncInvoiceToQBO(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/payment/:id', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const result = await quickbooksService.syncPaymentToQBO(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/customer/:id', authenticate, authorize('ADMIN', 'MANAGER'), async (req: Request, res: Response) => {
  try {
    const result = await quickbooksService.syncCustomerToQBO(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
