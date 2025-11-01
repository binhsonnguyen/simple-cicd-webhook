/**
 * Application Constants
 *
 * Centralized location for all constants used throughout the application
 */

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

// Error Messages
const ERROR_MESSAGES = {
  // Authentication
  NO_TOKEN_PROVIDED: 'Unauthorized: No token provided',
  INVALID_TOKEN: 'Forbidden: Invalid or unauthorized token',

  // Project Access
  NO_PROJECT_ASSIGNED: 'No project assigned to this client',
  NO_PROJECT_SPECIFIED: 'No project specified',
  PROJECT_UNAUTHORIZED: 'Not authorized for project',

  // Job Access
  NO_JOB_SPECIFIED: 'No job specified',
  JOB_NOT_FOUND: 'Job not found',

  // Server
  INTERNAL_ERROR: 'Internal server error',
  PUBLIC_KEY_NOT_FOUND: 'Server public key not found. Generate keys first.',
  FAILED_TO_RETRIEVE_PUBLIC_KEY: 'Failed to retrieve public key',
  FAILED_TO_RELOAD_KEYS: 'Failed to reload keys',
  FAILED_TO_LIST_JOBS: 'Failed to list jobs'
};

// Success Messages
const SUCCESS_MESSAGES = {
  KEYS_RELOADED: 'Authorized keys reloaded successfully',
  JOB_STARTED: 'Job started'
};

// Hints for Error Responses
const ERROR_HINTS = {
  INCLUDE_TOKEN: 'Include token in query param, body, or X-Webhook-Token header',
  INCLUDE_PROJECT: 'Include "project" parameter in request body or query string',
  INCLUDE_JOB: 'Include "job" parameter in request body or query string',
  CONTACT_ADMIN_PROJECT: 'Contact administrator to assign this client to a project'
};

// Directory Paths
const PATHS = {
  JOBS_DIR: 'jobs',
  CONFIG_DIR: 'config',
  LOGS_DIR: 'logs',
  KEYS_DIR: 'keys',
  AUTHORIZED_KEYS_FILE: 'config/authorized_keys.txt',
  CLIENT_PROJECTS_FILE: 'config/client_projects.json',
  SERVER_PUBLIC_KEY: 'keys/server_public.pem',
  SERVER_PRIVATE_KEY: 'keys/server_private.pem'
};

// Log Files
const LOG_FILES = {
  ERROR: 'error.log',
  COMBINED: 'combined.log'
};

// Security Settings
const SECURITY = {
  TOKEN_DISPLAY_LENGTH: 20,    // Max chars to show in logs
  CLIENT_KEY_DISPLAY_LENGTH: 50, // Max chars for client key in logs
  INVALID_PATH_CHARS: ['..', '/', '\\']
};

// Default Values
const DEFAULTS = {
  PORT: 3000,
  NODE_ENV: 'development',
  LOG_LEVEL: 'info'
};

// Response Status
const RESPONSE_STATUS = {
  OK: 'ok',
  ERROR: 'error',
  ACCEPTED: 'accepted'
};

module.exports = {
  HTTP_STATUS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  ERROR_HINTS,
  PATHS,
  LOG_FILES,
  SECURITY,
  DEFAULTS,
  RESPONSE_STATUS
};
