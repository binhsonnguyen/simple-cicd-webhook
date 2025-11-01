const { getClientProject, getProjectJobs, jobExists } = require('../utils/projectManager');
const { getBodyOrQuery } = require('../utils/requestHelpers');
const { sendForbidden, sendBadRequest, sendNotFound } = require('../utils/responseHelpers');
const { ERROR_MESSAGES, ERROR_HINTS } = require('../constants');

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
  const requestedProject = getBodyOrQuery(req, 'project');

  // Get client's assigned project
  const assignedProject = getClientProject(clientKey);

  // Validate project is assigned
  if (!assignedProject) {
    return sendForbidden(res, ERROR_MESSAGES.NO_PROJECT_ASSIGNED, {
      hint: ERROR_HINTS.CONTACT_ADMIN_PROJECT
    });
  }

  // Validate project parameter is provided
  if (!requestedProject) {
    return sendBadRequest(res, ERROR_MESSAGES.NO_PROJECT_SPECIFIED, {
      hint: ERROR_HINTS.INCLUDE_PROJECT
    });
  }

  // Validate client is authorized for requested project
  if (requestedProject !== assignedProject) {
    return sendForbidden(res, `${ERROR_MESSAGES.PROJECT_UNAUTHORIZED}: ${requestedProject}`, {
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
  const jobName = getBodyOrQuery(req, 'job');

  // Validate job name is provided
  if (!jobName) {
    return sendBadRequest(res, ERROR_MESSAGES.NO_JOB_SPECIFIED, {
      hint: ERROR_HINTS.INCLUDE_JOB
    });
  }

  // Validate job exists
  if (!jobExists(project, jobName)) {
    return sendNotFound(res, `${ERROR_MESSAGES.JOB_NOT_FOUND}: ${jobName}`, {
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
