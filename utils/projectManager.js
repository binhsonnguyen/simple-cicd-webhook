const fs = require('fs');
const path = require('path');
const { PATHS } = require('../constants');
const { isValidProjectName, isValidJobName, sanitizePath } = require('./validators');

const JOBS_DIR = path.join(__dirname, '..', PATHS.JOBS_DIR);
const CLIENT_PROJECTS_FILE = path.join(__dirname, '..', PATHS.CLIENT_PROJECTS_FILE);

let clientProjects = {};

/**
 * Load client-to-project mappings from config file
 * @returns {Object} Client projects configuration
 */
function loadClientProjects() {
  try {
    if (!fs.existsSync(CLIENT_PROJECTS_FILE)) {
      console.warn('Client projects file not found:', CLIENT_PROJECTS_FILE);
      clientProjects = { clients: {} };
      return clientProjects;
    }

    const content = fs.readFileSync(CLIENT_PROJECTS_FILE, 'utf8');
    clientProjects = JSON.parse(content);

    const clientCount = Object.keys(clientProjects.clients || {}).length;
    console.log(`Loaded project mappings for ${clientCount} clients`);
    return clientProjects;
  } catch (error) {
    console.error('Error loading client projects:', error.message);
    clientProjects = { clients: {} };
    return clientProjects;
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

  // Security: validate project name
  if (!isValidProjectName(projectName)) {
    return [];
  }

  const projectDir = sanitizePath(JOBS_DIR, projectName);

  if (!projectDir || !fs.existsSync(projectDir)) {
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

  // Security: validate names
  if (!isValidProjectName(projectName) || !isValidJobName(jobName)) {
    return false;
  }

  const jobPath = sanitizePath(JOBS_DIR, projectName, `${jobName}.sh`);

  if (!jobPath) {
    return false; // Path traversal detected
  }

  return fs.existsSync(jobPath);
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
  assignClientToProject,
  removeClientAssignment
};
