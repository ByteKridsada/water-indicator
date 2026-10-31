import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler } from './lib/errors.js';
import { authenticate } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import teamRoutes from './routes/teams.js';
import userRoutes from './routes/users.js';
import locationRoutes from './routes/locations.js';
import indicatorTypeRoutes from './routes/indicatorTypes.js';
import { locationReadings, readings } from './routes/readings.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // auth handles its own per-route access — register/login must stay public
  app.use('/api/v1/auth', authRoutes);

  app.use('/api/v1/teams', authenticate, teamRoutes);
  app.use('/api/v1/users', authenticate, userRoutes);
  app.use('/api/v1/locations/:locationId/readings', authenticate, locationReadings);
  app.use('/api/v1/locations', authenticate, locationRoutes);
  app.use('/api/v1/readings', authenticate, readings);
  app.use('/api/v1/indicator-types', authenticate, indicatorTypeRoutes);

  app.use((_req, res) =>
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'ไม่พบ endpoint นี้' } })
  );
  app.use(errorHandler);

  return app;
}
