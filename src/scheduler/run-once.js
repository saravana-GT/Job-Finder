import { scheduler } from './scheduler.js';
import { connect, disconnect } from '../database/connection.js';
import { logger } from '../utils/logger.js';

async function main() {
  logger.info('Starting manual scheduler execution run-once...', { module: 'scheduler' });
  try {
    // 1. Establish database connection
    await connect();

    // 2. Register job to execute (without cron pattern since it's manual execution)
    scheduler.registerJob(
      'job-scraper-manual',
      null,
      async () => {
        logger.info('Executing job-scraper-manual steps...', { module: 'scheduler' });
        const { providerManager } = await import('../services/providerManager.js');
        await providerManager.runSync();
      },
      { retries: 2, retryDelayMs: 3000 }
    );

    // 3. Execute the job
    await scheduler.runJob('job-scraper-manual');

    logger.info('Manual scheduler execution finished successfully.', { module: 'scheduler' });
    process.exit(0);
  } catch (error) {
    logger.error('Manual scheduler execution failed with errors', { module: 'scheduler', error });
    process.exit(1);
  } finally {
    // 4. Close database connection pool
    await disconnect();
  }
}

main();
