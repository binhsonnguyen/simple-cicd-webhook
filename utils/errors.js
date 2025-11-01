/**
 * Custom Error Classes
 *
 * Provides specific error types for better error handling and logging
 */

const { HTTP_STATUS } = require('../constants');

/**
 * Base application error class
 */
class AppError extends Error {
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, extra = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.extra = extra;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      status: 'error',
      message: this.message,
      ...this.extra
    };
  }
}

/**
 * Authentication-related errors (401)
 */
class AuthenticationError extends AppError {
  constructor(message, extra = {}) {
    super(message, HTTP_STATUS.UNAUTHORIZED, extra);
  }
}

/**
 * Authorization/Permission errors (403)
 */
class AuthorizationError extends AppError {
  constructor(message, extra = {}) {
    super(message, HTTP_STATUS.FORBIDDEN, extra);
  }
}

/**
 * Project access errors (403)
 */
class ProjectAccessError extends AuthorizationError {
  constructor(message, assignedProject = null, requestedProject = null) {
    const extra = {};
    if (assignedProject) extra.assignedProject = assignedProject;
    if (requestedProject) extra.requestedProject = requestedProject;

    super(message, extra);
  }
}

/**
 * Resource not found errors (404)
 */
class NotFoundError extends AppError {
  constructor(message, extra = {}) {
    super(message, HTTP_STATUS.NOT_FOUND, extra);
  }
}

/**
 * Job not found errors (404)
 */
class JobNotFoundError extends NotFoundError {
  constructor(jobName, project = null, availableJobs = []) {
    const message = `Job not found: ${jobName}`;
    const extra = {};
    if (project) extra.project = project;
    if (availableJobs.length > 0) extra.availableJobs = availableJobs;

    super(message, extra);
  }
}

/**
 * Validation errors (400)
 */
class ValidationError extends AppError {
  constructor(message, extra = {}) {
    super(message, HTTP_STATUS.BAD_REQUEST, extra);
  }
}

/**
 * Job execution errors
 */
class JobExecutionError extends AppError {
  constructor(message, jobName, exitCode = null, stderr = null) {
    const extra = { jobName };
    if (exitCode !== null) extra.exitCode = exitCode;
    if (stderr) extra.stderr = stderr;

    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, extra);
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

/**
 * Configuration errors
 */
class ConfigurationError extends AppError {
  constructor(message, missingConfig = null) {
    const extra = {};
    if (missingConfig) extra.missingConfig = missingConfig;

    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, extra);
  }
}

module.exports = {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ProjectAccessError,
  NotFoundError,
  JobNotFoundError,
  ValidationError,
  JobExecutionError,
  ConfigurationError
};
