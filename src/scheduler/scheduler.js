import cron from 'node-cron';
import { LogRepository } from '../repositories/logRepository.js';
import { logger } from '../utils/logger.js';

class Scheduler {
  constructor() {
    this.jobs = new Map();
    this.cronTasks = [];
    this.logRepository = new LogRepository();
  }

  /**
   * Register a job in the scheduler.
   * @param {string} name Unique name of the job
   * @param {string|null} cronExpression Cron schedule (e.g. cron string) or null for manual-only
   * @param {Function} jobFn Async function to execute
   * @param {Object} options Configuration options
   */
  registerJob(name, cronExpression, jobFn, options = {}) {
    const { retries = 3, retryDelayMs = 5000 } = options;
    this.jobs.set(name, { name, cronExpression, jobFn, retries, retryDelayMs });
    logger.info(`Registered job: "${name}" [cron: ${cronExpression || 'manual-only'}, retries: ${retries}]`, { module: 'scheduler' });
  }

  /**
   * Manually execute a registered job by name with retry mechanism and database log updates.
   * @param {string} name Job name
   */
  async runJob(name) {
    const job = this.jobs.get(name);
    if (!job) {
      const errorMsg = `Job "${name}" not found in scheduler registration.`;
      logger.error(errorMsg, { module: 'scheduler' });
      throw new Error(errorMsg);
    }

    const startTime = new Date();
    logger.info(`Starting execution of job: "${name}"`, { module: 'scheduler' });

    let status = 'success';
    let error = null;
    let attempt = 0;
    const maxAttempts = job.retries + 1;

    while (attempt < maxAttempts) {
      try {
        attempt++;
        await job.jobFn();
        break; // Success, exit retry loop
      } catch (err) {
        error = err;
        logger.warn(`Job "${name}" failed on attempt ${attempt}/${maxAttempts}: ${err.message}`, { module: 'scheduler', error: err });
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, job.retryDelayMs));
        } else {
          status = 'failed';
        }
      }
    }

    const endTime = new Date();
    const durationMs = endTime - startTime;

    const logPayload = {
      jobName: name,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMs,
      status,
      attempts: attempt,
      error: error ? error.message : null,
    };

    const logMsg = `Job "${name}" execution completed: ${status.toUpperCase()} in ${durationMs}ms [Attempts: ${attempt}]`;
    if (status === 'success') {
      logger.info(logMsg, { module: 'scheduler' });
    } else {
      logger.error(logMsg, { module: 'scheduler', error });
    }

    // Attempt to log to the database logs table
    try {
      await this.logRepository.createLog({
        module: 'scheduler',
        level: status === 'success' ? 'INFO' : 'ERROR',
        message: logPayload,
      });
    } catch (dbErr) {
      // Don't crash if the database log insert fails, but log it locally
      logger.error('Failed to save scheduler execution logs to database', { module: 'scheduler', error: dbErr });
    }

    if (status === 'failed') {
      throw error;
    }
  }

  /**
   * Start all registered cron jobs.
   */
  start() {
    // Prevent starting multiple instances
    this.stop();

    for (const [name, job] of this.jobs.entries()) {
      if (job.cronExpression) {
        const task = cron.schedule(job.cronExpression, async () => {
          try {
            await this.runJob(name);
          } catch (err) {
            logger.error(`Automated execution of scheduled job "${name}" failed`, { module: 'scheduler', error: err });
          }
        });
        this.cronTasks.push(task);
        logger.info(`Scheduled job "${name}" running on expression: "${job.cronExpression}"`, { module: 'scheduler' });
      }
    }
  }

  /**
   * Stop all active cron tasks.
   */
  stop() {
    if (this.cronTasks.length > 0) {
      for (const task of this.cronTasks) {
        task.stop();
      }
      this.cronTasks = [];
      logger.info('Stopped all active scheduler tasks.', { module: 'scheduler' });
    }
  }
}

export const scheduler = new Scheduler();
export default scheduler;
