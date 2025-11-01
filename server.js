require('dotenv').config();
const express = require('express');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { authenticateWebhook, reloadAuthorizedKeys } = require('./middleware/auth');
const { validateProjectAccess, validateJobAccess } = require('./middleware/projectAuth');
const { loadKey } = require('./utils/keyManager');
const {
  getClientProject,
  getProjectJobs,
  executeJob,
  loadClientProjects
} = require('./utils/projectManager');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
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
    // Write all logs to logs/combined.log
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'combined.log')
    })
  ]
});

const app = express();
const PORT = process.env.PORT || 3000;

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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public key endpoint - allows clients to fetch server's public key
app.get('/public-key', (req, res) => {
  try {
    const publicKeyPath = process.env.SERVER_PUBLIC_KEY_PATH ||
      path.join(__dirname, 'keys', 'server_public.pem');

    if (!fs.existsSync(publicKeyPath)) {
      return res.status(404).json({
        status: 'error',
        message: 'Server public key not found. Generate keys first.'
      });
    }

    const publicKey = loadKey(publicKeyPath);

    res.json({
      status: 'ok',
      publicKey: publicKey,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching public key', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve public key'
    });
  }
});

// Admin endpoint to reload authorized keys (requires authentication)
app.post('/admin/reload-keys', authenticateWebhook, (req, res) => {
  try {
    reloadAuthorizedKeys();
    res.json({
      status: 'ok',
      message: 'Authorized keys reloaded successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error reloading keys', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to reload keys'
    });
  }
});

// Get client's project and available jobs
app.get('/jobs', authenticateWebhook, (req, res) => {
  try {
    const clientKey = req.clientKey;
    const project = getClientProject(clientKey);

    if (!project) {
      return res.status(403).json({
        status: 'error',
        message: 'No project assigned to this client'
      });
    }

    const jobs = getProjectJobs(project);

    res.json({
      status: 'ok',
      project,
      jobs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error listing jobs', { error: error.message });
    res.status(500).json({
      status: 'error',
      message: 'Failed to list jobs'
    });
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
      clientKey: clientKey.substring(0, 50) + '...',
      project,
      jobName
    });

    // Execute the job
    try {
      logger.info('Starting job execution', { project, job: jobName });

      // Send immediate response to client
      res.json({
        status: 'accepted',
        message: 'Job started',
        project,
        job: jobName,
        timestamp: new Date().toISOString()
      });

      // Execute job asynchronously
      const result = await executeJob(project, jobName, {
        env: {
          WEBHOOK_CLIENT: clientKey.substring(0, 50),
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

  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Webhook server started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
