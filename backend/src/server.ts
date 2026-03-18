import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import logger from './config/logger';
import { errorHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth.routes';
import invoiceRoutes from './routes/invoice.routes';
import paymentRoutes from './routes/payment.routes';
import inventoryRoutes from './routes/inventory.routes';
import routeRoutes from './routes/route.routes';
import creditRoutes from './routes/credit.routes';
import syncRoutes from './routes/sync.routes';
import qboRoutes from './routes/qbo.routes';
import analyticsRoutes from './routes/analytics.routes';
import dexRoutes from './routes/dex.routes';
import customerRoutes from './routes/customer.routes';
import productRoutes from './routes/product.routes';

// Background jobs
import { startQBOSyncJob, startInsightsJob, startDriverPerformanceJob } from './jobs/qbo-sync.job';

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' })); // Larger limit for signature data

// Rate limiting
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/qbo', qboRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/dex', dexRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);

// Error handler
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  logger.info(`OLMOS_DSD API server running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);

  // Start background jobs
  if (config.nodeEnv !== 'test') {
    startQBOSyncJob();
    startInsightsJob();
    startDriverPerformanceJob();
  }
});

export default app;
