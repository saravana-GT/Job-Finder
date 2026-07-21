import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import router from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { connect, query } from './database/connection.js';
import { runMigrations } from './database/migrate.js';
import { initTelegramBot } from './telegram/bot.js';
import { registerBotCallbacks } from './telegram/handlers/botCallbacks.js';
import { startScheduler } from './scheduler/index.js';
import { providerManager } from './scrapers/providerManager.js';

const app = express();

// Request logging middleware for monitoring and auditing
app.use((req, res, next) => {
  logger.info(`[HTTP Request] ${req.method} ${req.url}`, {
    module: 'http',
    method: req.method,
    url: req.url,
    ip: req.ip || req.headers['x-forwarded-for'],
    userAgent: req.headers['user-agent'],
  });

  res.on('finish', () => {
    if (res.statusCode === 403) {
      logger.warn(`[HTTP 403 Access Denied] ${req.method} ${req.url}`, {
        module: 'security',
        method: req.method,
        url: req.url,
        statusCode: 403,
        reason: 'Access forbidden on endpoint',
      });
    }
  });

  next();
});

app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'] }));
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      const publicPaths = ['/', '/health', '/health/liveness', '/health/readiness', '/api/health'];
      return publicPaths.includes(req.path);
    },
  })
);

// Public Root Endpoint - Explicitly defined HTTP 200 response
app.get('/', (req, res) => {
  res.status(200).send('Backend Running');
});

// Public Health Endpoint - Standard health check for monitoring probes (UptimeRobot, Render)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

app.get('/health/liveness', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Liveness probe passed' });
});

app.get('/health/readiness', async (req, res) => {
  try {
    await query('SELECT 1');
    res.status(200).json({ status: 'UP', message: 'Readiness probe passed' });
  } catch (error) {
    logger.error('Readiness probe failed', { module: 'app', error });
    res.status(503).json({ status: 'DOWN', error: error.message });
  }
});

app.use(express.static('public'));

app.use('/api', router);
app.use(notFoundHandler);
app.use(errorHandler);

const port = config.port;

if (process.argv[1] && process.argv[1].includes('app.js')) {
  app.listen(port, async () => {
    logger.info(`Server listening on port ${port}`, { module: 'app' });
    try {
      // 1. Establish database connection pool
      await connect();

      // 2. Perform DB schema migrations automatically
      await runMigrations();

      // 3. Load Scraper Providers dynamically
      await providerManager.loadProviders();

      // 4. Initialize Telegram Bot and register message handlers
      const bot = initTelegramBot();
      registerBotCallbacks(bot);

      // 5. Register recurring background cron jobs
      startScheduler();

      // Trigger initial background job ingestion crawl and matching calculations immediately
      (async () => {
        try {
          logger.info('Triggering initial background job sync on startup...', { module: 'app' });
          await providerManager.runSync();
          logger.info('Initial job sync completed. Recalculating AI match scores...', { module: 'app' });
          const { recommendationEngine } = await import('./services/recommendationEngine.js');
          const { profileService } = await import('./services/profileService.js');
          const profile = await profileService.getProfile();
          await recommendationEngine.recalculateAllJobScores(profile);
          logger.info('Initial background startup tasks completed successfully.', { module: 'app' });
        } catch (syncErr) {
          logger.error('Initial background startup sync/matching tasks failed', { module: 'app', error: syncErr });
        }
      })();

      logger.info('Placement Assistant bootstrap completed successfully.', { module: 'app' });
    } catch (error) {
      logger.error('Placement Assistant startup bootstrap failed', { module: 'app', error });
      process.exit(1);
    }
  });
}

export { app };
