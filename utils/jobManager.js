const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const JOBS_DIR = path.join(__dirname, '../jobs');
const PERMISSIONS_FILE = path.join(__dirname, '../config/job_permissions.json');

let jobPermissions = {};

/**
 * Load job permissions from config file
 */
function loadJobPermissions() {
  try {
    if (!fs.existsSync(PERMISSIONS_FILE)) {
      console.warn('Job permissions file not found:', PERMISSIONS_FILE);
      jobPermissions = { permissions: {} };
      return;
    }

    const content = fs.readFileSync(PERMISSIONS_FILE, 'utf8');
    jobPermissions = JSON.parse(content);

    const clientCount = Object.keys(jobPermissions.permissions || {}).length;
    console.log(`Loaded job permissions for ${clientCount} clients`);
  } catch (error) {
    console.error('Error loading job permissions:', error.message);
    jobPermissions = { permissions: {} };
  }
}

// Initial load
loadJobPermissions();

/**
 * Get list of all available jobs
 * @returns {Array} Array of job names
 */
function getAvailableJobs() {
  try {
    if (!fs.existsSync(JOBS_DIR)) {
      return [];
    }

    const files = fs.readdirSync(JOBS_DIR);
    return files
      .filter(file => file.endsWith('.sh'))
      .map(file => file.replace('.sh', ''));
  } catch (error) {
    console.error('Error listing jobs:', error.message);
    return [];
  }
}

/**
 * Get allowed jobs for a specific client
 * @param {string} clientKey - Client's public key
 * @returns {Array} Array of allowed job names
 */
function getAllowedJobs(clientKey) {
  if (!clientKey) return [];

  const normalizedKey = clientKey.trim();
  const permissions = jobPermissions.permissions || {};

  // Find exact match
  if (permissions[normalizedKey]) {
    return permissions[normalizedKey].allowedJobs || [];
  }

  // Check default permissions
  if (jobPermissions.defaultPermissions?.enabled) {
    return jobPermissions.defaultPermissions.allowedJobs || [];
  }

  return [];
}

/**
 * Check if a client is allowed to run a specific job
 * @param {string} clientKey - Client's public key
 * @param {string} jobName - Job name to check
 * @returns {boolean} True if allowed
 */
function isJobAllowed(clientKey, jobName) {
  const allowedJobs = getAllowedJobs(clientKey);
  return allowedJobs.includes(jobName);
}

/**
 * Validate job exists in jobs directory
 * @param {string} jobName - Job name to validate
 * @returns {boolean} True if job exists
 */
function jobExists(jobName) {
  if (!jobName || jobName.includes('..') || jobName.includes('/')) {
    return false; // Prevent directory traversal
  }

  const jobPath = path.join(JOBS_DIR, `${jobName}.sh`);
  return fs.existsSync(jobPath);
}

/**
 * Execute a job script
 * @param {string} jobName - Job name to execute
 * @param {Object} options - Execution options
 * @param {Object} options.env - Environment variables to pass to the job
 * @param {Function} options.onOutput - Callback for stdout/stderr output
 * @param {Function} options.onComplete - Callback when job completes
 * @returns {Object} Job execution information
 */
function executeJob(jobName, options = {}) {
  return new Promise((resolve, reject) => {
    if (!jobExists(jobName)) {
      return reject(new Error(`Job not found: ${jobName}`));
    }

    const jobPath = path.join(JOBS_DIR, `${jobName}.sh`);
    const startTime = Date.now();

    // Prepare environment variables
    const env = {
      ...process.env,
      ...(options.env || {}),
      JOB_NAME: jobName,
      JOB_START_TIME: new Date().toISOString()
    };

    // Spawn the job process
    const jobProcess = spawn('/bin/bash', [jobPath], {
      env,
      cwd: JOBS_DIR
    });

    let stdout = '';
    let stderr = '';

    // Capture stdout
    jobProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      if (options.onOutput) {
        options.onOutput('stdout', output);
      }
    });

    // Capture stderr
    jobProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      if (options.onOutput) {
        options.onOutput('stderr', output);
      }
    });

    // Handle process completion
    jobProcess.on('close', (exitCode) => {
      const duration = Date.now() - startTime;
      const result = {
        jobName,
        exitCode,
        success: exitCode === 0,
        duration,
        stdout,
        stderr,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString()
      };

      if (options.onComplete) {
        options.onComplete(result);
      }

      if (exitCode === 0) {
        resolve(result);
      } else {
        reject(Object.assign(new Error(`Job failed with exit code ${exitCode}`), result));
      }
    });

    // Handle process errors
    jobProcess.on('error', (error) => {
      const result = {
        jobName,
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };

      if (options.onComplete) {
        options.onComplete(result);
      }

      reject(Object.assign(error, result));
    });
  });
}

/**
 * Add or update job permissions for a client
 * @param {string} clientKey - Client's public key
 * @param {Array} allowedJobs - Array of allowed job names
 * @param {string} description - Description of the client
 */
function setClientPermissions(clientKey, allowedJobs, description = '') {
  if (!jobPermissions.permissions) {
    jobPermissions.permissions = {};
  }

  jobPermissions.permissions[clientKey.trim()] = {
    description,
    allowedJobs
  };

  // Save to file
  fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(jobPermissions, null, 2), 'utf8');
  console.log(`Updated permissions for client: ${description || 'Unknown'}`);
}

module.exports = {
  loadJobPermissions,
  getAvailableJobs,
  getAllowedJobs,
  isJobAllowed,
  jobExists,
  executeJob,
  setClientPermissions
};
