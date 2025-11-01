const { getClientProject, getProjectJobs, jobExists } = require('../utils/projectManager');

/**
 * Middleware to validate client's project access
 *
 * Prerequisites: authenticateWebhook (needs req.clientKey)
 * Sets: req.project
 *
 * Validates:
 * 1. Client has a project assigned
 * 2. Request includes project parameter
 * 3. Requested project matches assigned project
 */
function validateProjectAccess(req, res, next) {
  const clientKey = req.clientKey;
  const requestedProject = req.body.project || req.query.project;

  // Get client's assigned project
  const assignedProject = getClientProject(clientKey);

  // Validate project is assigned
  if (!assignedProject) {
    return res.status(403).json({
      status: 'error',
      message: 'No project assigned to this client',
      hint: 'Contact administrator to assign this client to a project'
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

  // Validate client is authorized for requested project
  if (requestedProject !== assignedProject) {
    return res.status(403).json({
      status: 'error',
      message: `Not authorized for project: ${requestedProject}`,
      assignedProject: assignedProject
    });
  }

  // Attach project info to request
  req.project = assignedProject;
  next();
}

/**
 * Middleware to validate job exists in project
 *
 * Prerequisites: validateProjectAccess (needs req.project)
 * Sets: req.jobName
 *
 * Validates:
 * 1. Request includes job parameter
 * 2. Job exists in the project directory
 */
function validateJobAccess(req, res, next) {
  const project = req.project;
  const jobName = req.body.job || req.query.job;

  // Validate job name is provided
  if (!jobName) {
    return res.status(400).json({
      status: 'error',
      message: 'No job specified',
      hint: 'Include "job" parameter in request body or query string'
    });
  }

  // Validate job exists
  if (!jobExists(project, jobName)) {
    return res.status(404).json({
      status: 'error',
      message: `Job not found: ${jobName}`,
      project: project,
      availableJobs: getProjectJobs(project)
    });
  }

  // Attach job name to request
  req.jobName = jobName;
  next();
}

module.exports = {
  validateProjectAccess,
  validateJobAccess
};
