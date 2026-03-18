import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { syncService } from '../services/sync.service';

const router = Router();
router.use(authenticate);

router.post('/', async (req: Request, res: Response) => {
  try {
    const result = await syncService.processSync(req.user!.userId, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
