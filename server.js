require('dotenv').config();
const express = require('express');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const { authenticateWebhook, reloadAuthorizedKeys } = require('./middleware/auth');
const { loadKey } = require('./utils/keyManager');
const {
  getClientProject,
  getAvailableProjects,
  getProjectJobs,
  jobExists,
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

// Webhook endpoint - protected with authentication
app.post('/webhook', authenticateWebhook, async (req, res) => {
  const clientKey = req.clientKey;
  const requestedProject = req.body.project || req.query.project;
  const jobName = req.body.job || req.query.job;

  // Get client's assigned project
  const assignedProject = getClientProject(clientKey);

  logger.info('Webhook received and authenticated', {
    clientKey: clientKey.substring(0, 50) + '...',
    assignedProject,
    requestedProject,
    jobName,
    body: req.body
  });

  // Validate project is assigned
  if (!assignedProject) {
    return res.status(403).json({
      status: 'error',
      message: 'No project assigned to this client'
    });
  }

  // Validate project parameter is provided
  if (!requestedProject) {
    return res.status(400).json({
      status: 'error',
      message: 'No project specified',
      hint: 'Include "project" parameter in request body or query string'
    });
  }

  // Validate job name is provided
  if (!jobName) {
    return res.status(400).json({
      status: 'error',
      message: 'No job specified',
      hint: 'Include "job" parameter in request body or query string'
    });
  }

  // Validate client is authorized for requested project
  if (requestedProject !== assignedProject) {
    logger.warn('Unauthorized project access attempt', {
      clientKey: clientKey.substring(0, 50) + '...',
      assignedProject,
      requestedProject
    });

    return res.status(403).json({
      status: 'error',
      message: `Not authorized for project: ${requestedProject}`,
      assignedProject: assignedProject
    });
  }

  // Validate job exists
  if (!jobExists(assignedProject, jobName)) {
    return res.status(404).json({
      status: 'error',
      message: `Job not found: ${jobName}`,
      project: assignedProject,
      availableJobs: getProjectJobs(assignedProject)
    });
  }

  // Execute the job
  try {
    logger.info('Starting job execution', { project: assignedProject, job: jobName });

    // Send immediate response to client
    res.json({
      status: 'accepted',
      message: 'Job started',
      project: assignedProject,
      job: jobName,
      timestamp: new Date().toISOString()
    });

    // Execute job asynchronously
    const result = await executeJob(assignedProject, jobName, {
      env: {
        WEBHOOK_CLIENT: clientKey.substring(0, 50),
        WEBHOOK_TIMESTAMP: new Date().toISOString(),
        ...(req.body.env || {})
      },
      onOutput: (stream, data) => {
        logger.info(`Job output [${assignedProject}/${jobName}]`, { stream, data: data.trim() });
      }
    });

    logger.info('Job completed successfully', {
      project: assignedProject,
      job: jobName,
      exitCode: result.exitCode,
      duration: result.duration
    });

  } catch (error) {
    logger.error('Job execution failed', {
      project: assignedProject,
      job: jobName,
      error: error.message,
      exitCode: error.exitCode,
      stderr: error.stderr
    });
  }
});

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
