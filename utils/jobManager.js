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
 * Recursively scan for job files in subdirectories
 * @param {string} dir - Directory to scan
 * @param {string} prefix - Path prefix for grouped jobs
 * @returns {Array} Array of job paths
 */
function scanJobsRecursive(dir, prefix = '') {
  const jobs = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subJobs = scanJobsRecursive(fullPath, prefix ? `${prefix}/${entry.name}` : entry.name);
        jobs.push(...subJobs);
      } else if (entry.isFile() && entry.name.endsWith('.sh')) {
        // Add job with group prefix
        const jobName = entry.name.replace('.sh', '');
        jobs.push(prefix ? `${prefix}/${jobName}` : jobName);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error.message);
  }

  return jobs;
}

/**
 * Get list of all available jobs (supports grouped jobs)
 * @returns {Array} Array of job names in format "group/job" or "job"
 */
function getAvailableJobs() {
  try {
    if (!fs.existsSync(JOBS_DIR)) {
      return [];
    }

    return scanJobsRecursive(JOBS_DIR);
  } catch (error) {
    console.error('Error listing jobs:', error.message);
    return [];
  }
}

/**
 * Get available jobs grouped by directory
 * @returns {Object} Jobs grouped by their directory
 */
function getAvailableJobsGrouped() {
  const allJobs = getAvailableJobs();
  const grouped = {};

  allJobs.forEach(job => {
    const parts = job.split('/');
    if (parts.length > 1) {
      const group = parts.slice(0, -1).join('/');
      const jobName = parts[parts.length - 1];

      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(jobName);
    } else {
      // Jobs without a group go into 'root'
      if (!grouped['_root']) {
        grouped['_root'] = [];
      }
      grouped['_root'].push(job);
    }
  });

  return grouped;
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
 * Validate job exists in jobs directory (supports grouped jobs)
 * @param {string} jobName - Job name to validate (can be "group/job" format)
 * @returns {boolean} True if job exists
 */
function jobExists(jobName) {
  if (!jobName) {
    return false;
  }

  // Security check: prevent directory traversal
  if (jobName.includes('..') || jobName.startsWith('/') || jobName.includes('\\')) {
    return false;
  }

  // Allow forward slashes for grouped jobs, but validate each part
  const parts = jobName.split('/');
  for (const part of parts) {
    if (!part || part === '.' || part === '..') {
      return false;
    }
  }

  const jobPath = path.join(JOBS_DIR, `${jobName}.sh`);

  // Additional security check: ensure resolved path is within JOBS_DIR
  const resolvedPath = path.resolve(jobPath);
  const resolvedJobsDir = path.resolve(JOBS_DIR);

  if (!resolvedPath.startsWith(resolvedJobsDir)) {
    return false; // Path escapes jobs directory
  }

  return fs.existsSync(jobPath);
}

/**
 * Execute a job script (supports grouped jobs)
 * @param {string} jobName - Job name to execute (can be "group/job" format)
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
    const jobDir = path.dirname(jobPath);
    const startTime = Date.now();

    // Prepare environment variables
    const env = {
      ...process.env,
      ...(options.env || {}),
      JOB_NAME: jobName,
      JOB_GROUP: jobName.includes('/') ? jobName.split('/').slice(0, -1).join('/') : '',
      JOB_START_TIME: new Date().toISOString()
    };

    // Spawn the job process in the job's directory
    const jobProcess = spawn('/bin/bash', [jobPath], {
      env,
      cwd: jobDir
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
  getAvailableJobsGrouped,
  getAllowedJobs,
  isJobAllowed,
  jobExists,
  executeJob,
  setClientPermissions
};
