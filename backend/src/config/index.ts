import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root so it works when running from monorepo root (npm run backend:dev)
const backendRoot = path.join(__dirname, '../..');
dotenv.config({ path: path.join(backendRoot, '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: '7d',
  },
  qbo: {
    clientId: process.env.QBO_CLIENT_ID || '',
    clientSecret: process.env.QBO_CLIENT_SECRET || '',
    redirectUri: process.env.QBO_REDIRECT_URI || 'http://localhost:3001/api/qbo/callback',
    environment: (process.env.QBO_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
  },
};
