const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const JOBS_DIR = path.join(__dirname, '../jobs');
const CLIENT_PROJECTS_FILE = path.join(__dirname, '../config/client_projects.json');

let clientProjects = {};

/**
 * Load client-to-project mappings from config file
 */
function loadClientProjects() {
  try {
    if (!fs.existsSync(CLIENT_PROJECTS_FILE)) {
      console.warn('Client projects file not found:', CLIENT_PROJECTS_FILE);
      clientProjects = { clients: {} };
      return;
    }

    const content = fs.readFileSync(CLIENT_PROJECTS_FILE, 'utf8');
    clientProjects = JSON.parse(content);

    const clientCount = Object.keys(clientProjects.clients || {}).length;
    console.log(`Loaded project mappings for ${clientCount} clients`);
  } catch (error) {
    console.error('Error loading client projects:', error.message);
    clientProjects = { clients: {} };
  }
}

// Initial load
loadClientProjects();

/**
 * Get project assigned to a client
 * @param {string} clientKey - Client's public key
 * @returns {string|null} Project name or null if not found
 */
function getClientProject(clientKey) {
  if (!clientKey) return null;

  const normalizedKey = clientKey.trim();
  const clients = clientProjects.clients || {};

  if (clients[normalizedKey]) {
    return clients[normalizedKey].project;
  }

  return null;
}

/**
 * Get all available projects
 * @returns {Array} Array of project names
 */
function getAvailableProjects() {
  try {
    if (!fs.existsSync(JOBS_DIR)) {
      return [];
    }

    const entries = fs.readdirSync(JOBS_DIR, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch (error) {
    console.error('Error listing projects:', error.message);
    return [];
  }
}

/**
 * Get all jobs for a specific project
 * @param {string} projectName - Project name
 * @returns {Array} Array of job names
 */
function getProjectJobs(projectName) {
  if (!projectName) return [];

  // Security: prevent directory traversal
  if (projectName.includes('..') || projectName.includes('/') || projectName.includes('\\')) {
    return [];
  }

  const projectDir = path.join(JOBS_DIR, projectName);

  if (!fs.existsSync(projectDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(projectDir);
    return files
      .filter(file => file.endsWith('.sh'))
      .map(file => file.replace('.sh', ''));
  } catch (error) {
    console.error(`Error listing jobs for project ${projectName}:`, error.message);
    return [];
  }
}

/**
 * Validate job exists for a project
 * @param {string} projectName - Project name
 * @param {string} jobName - Job name
 * @returns {boolean} True if job exists
 */
function jobExists(projectName, jobName) {
  if (!projectName || !jobName) {
    return false;
  }

  // Security checks
  if (projectName.includes('..') || projectName.includes('/') || projectName.includes('\\')) {
    return false;
  }

  if (jobName.includes('..') || jobName.includes('/') || jobName.includes('\\')) {
    return false;
  }

  const jobPath = path.join(JOBS_DIR, projectName, `${jobName}.sh`);

  // Additional security: ensure resolved path is within JOBS_DIR
  const resolvedPath = path.resolve(jobPath);
  const resolvedJobsDir = path.resolve(JOBS_DIR);

  if (!resolvedPath.startsWith(resolvedJobsDir)) {
    return false;
  }

  return fs.existsSync(jobPath);
}

/**
 * Execute a job for a project
 * @param {string} projectName - Project name
 * @param {string} jobName - Job name
 * @param {Object} options - Execution options
 * @param {Object} options.env - Environment variables to pass to the job
 * @param {Function} options.onOutput - Callback for stdout/stderr output
 * @param {Function} options.onComplete - Callback when job completes
 * @returns {Promise} Job execution information
 */
function executeJob(projectName, jobName, options = {}) {
  return new Promise((resolve, reject) => {
    if (!jobExists(projectName, jobName)) {
      return reject(new Error(`Job not found: ${projectName}/${jobName}`));
    }

    const jobPath = path.join(JOBS_DIR, projectName, `${jobName}.sh`);
    const jobDir = path.dirname(jobPath);
    const startTime = Date.now();

    // Prepare environment variables
    const env = {
      ...process.env,
      ...(options.env || {}),
      PROJECT_NAME: projectName,
      JOB_NAME: jobName,
      JOB_START_TIME: new Date().toISOString()
    };

    // Spawn the job process in the project's directory
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
        projectName,
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
        projectName,
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
 * Assign a client to a project
 * @param {string} clientKey - Client's public key
 * @param {string} projectName - Project name
 * @param {string} description - Description of the client
 */
function assignClientToProject(clientKey, projectName, description = '') {
  if (!clientProjects.clients) {
    clientProjects.clients = {};
  }

  clientProjects.clients[clientKey.trim()] = {
    description,
    project: projectName
  };

  // Save to file
  fs.writeFileSync(CLIENT_PROJECTS_FILE, JSON.stringify(clientProjects, null, 2), 'utf8');
  console.log(`Assigned client to project: ${projectName}`);
}

/**
 * Remove client assignment
 * @param {string} clientKey - Client's public key
 */
function removeClientAssignment(clientKey) {
  if (!clientProjects.clients) {
    return false;
  }

  const normalizedKey = clientKey.trim();
  if (clientProjects.clients[normalizedKey]) {
    delete clientProjects.clients[normalizedKey];
    fs.writeFileSync(CLIENT_PROJECTS_FILE, JSON.stringify(clientProjects, null, 2), 'utf8');
    return true;
  }

  return false;
}

module.exports = {
  loadClientProjects,
  getClientProject,
  getAvailableProjects,
  getProjectJobs,
  jobExists,
  executeJob,
  assignClientToProject,
  removeClientAssignment
};
