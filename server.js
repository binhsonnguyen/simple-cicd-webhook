require('dotenv').config();
const express = require('express');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { authenticateWebhook, reloadAuthorizedKeys } = require('./middleware/auth');
const { validateProjectAccess, validateJobAccess } = require('./middleware/projectAuth');
const { loadKey } = require('./utils/keyManager');
const {
  sendSuccess,
  sendAccepted,
  sendNotFound,
  sendForbidden,
  sendInternalError
} = require('./utils/responseHelpers');
const {
  getClientProject,
  getProjectJobs,
  loadClientProjects
} = require('./utils/projectManager');
const { executeJob } = require('./utils/jobExecutor');
const { sanitizeClientKey } = require('./utils/security');
const { validateEnvironment } = require('./utils/envValidator');
const {
  DEFAULTS,
  PATHS,
  LOG_FILES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
} = require('./constants');

// Validate environment at startup
let envConfig;
try {
  const validationResult = validateEnvironment();
  envConfig = validationResult.config;

  // Log warnings if any
  if (validationResult.warnings.length > 0) {
    console.warn('Environment validation warnings:');
    validationResult.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
} catch (error) {
  console.error('Environment validation failed:', error.message);
  process.exit(1);
}

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || DEFAULTS.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'webhook-server' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Write all logs to logs/
    new winston.transports.File({
      filename: path.join(__dirname, PATHS.LOGS_DIR, LOG_FILES.ERROR),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(__dirname, PATHS.LOGS_DIR, LOG_FILES.COMBINED)
    })
  ]
});

const app = express();
const PORT = envConfig.port;

// Middleware to parse JSON bodies
app.use(express.json());

// Middleware to log all incoming requests
app.use((req, res, next) => {
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    headers: req.headers,
    body: req.body
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  sendSuccess(res);
});

// Public key endpoint - allows clients to fetch server's public key
app.get('/public-key', (req, res) => {
  try {
    const publicKeyPath = envConfig.serverPublicKeyPath;

    if (!fs.existsSync(publicKeyPath)) {
      return sendNotFound(res, ERROR_MESSAGES.PUBLIC_KEY_NOT_FOUND);
    }

    const publicKey = loadKey(publicKeyPath);

    sendSuccess(res, { publicKey });
  } catch (error) {
    logger.error('Error fetching public key', { error: error.message });
    sendInternalError(res, ERROR_MESSAGES.FAILED_TO_RETRIEVE_PUBLIC_KEY);
  }
});

// Admin endpoint to reload authorized keys (requires authentication)
app.post('/admin/reload-keys', authenticateWebhook, (req, res) => {
  try {
    reloadAuthorizedKeys();
    sendSuccess(res, { message: SUCCESS_MESSAGES.KEYS_RELOADED });
  } catch (error) {
    logger.error('Error reloading keys', { error: error.message });
    sendInternalError(res, ERROR_MESSAGES.FAILED_TO_RELOAD_KEYS);
  }
});

// Get client's project and available jobs
app.get('/jobs', authenticateWebhook, (req, res) => {
  try {
    const clientKey = req.clientKey;
    const project = getClientProject(clientKey);

    if (!project) {
      return sendForbidden(res, ERROR_MESSAGES.NO_PROJECT_ASSIGNED);
    }

    const jobs = getProjectJobs(project);

    sendSuccess(res, { project, jobs });
  } catch (error) {
    logger.error('Error listing jobs', { error: error.message });
    sendInternalError(res, ERROR_MESSAGES.FAILED_TO_LIST_JOBS);
  }
});

// Webhook endpoint - protected with authentication and project validation
app.post('/webhook',
  authenticateWebhook,      // Step 1: Authenticate client
  validateProjectAccess,    // Step 2: Validate project access
  validateJobAccess,        // Step 3: Validate job exists
  async (req, res) => {
    // All validation done by middleware
    const clientKey = req.clientKey;  // from authenticateWebhook
    const project = req.project;      // from validateProjectAccess
    const jobName = req.jobName;      // from validateJobAccess

    logger.info('Webhook received - executing job', {
      clientKey: sanitizeClientKey(clientKey),
      project,
      jobName
    });

    // Execute the job
    try {
      logger.info('Starting job execution', { project, job: jobName });

      // Send immediate response to client
      sendAccepted(res, SUCCESS_MESSAGES.JOB_STARTED, {
        project,
        job: jobName
      });

      // Execute job asynchronously
      const result = await executeJob(project, jobName, {
        env: {
          WEBHOOK_CLIENT: sanitizeClientKey(clientKey),
          WEBHOOK_TIMESTAMP: new Date().toISOString(),
          ...(req.body.env || {})
        },
        onOutput: (stream, data) => {
          logger.info(`Job output [${project}/${jobName}]`, { stream, data: data.trim() });
        }
      });

      logger.info('Job completed successfully', {
        project,
        job: jobName,
        exitCode: result.exitCode,
        duration: result.duration
      });

    } catch (error) {
      logger.error('Job execution failed', {
        project,
        job: jobName,
        error: error.message,
        exitCode: error.exitCode,
        stderr: error.stderr
      });
    }
  }
);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    path: req.path
  });

  sendInternalError(res, ERROR_MESSAGES.INTERNAL_ERROR);
});

// Start server
app.listen(PORT, () => {
  logger.info(`Webhook server started on port ${PORT}`);
  logger.info(`Environment: ${envConfig.nodeEnv}`);
});
