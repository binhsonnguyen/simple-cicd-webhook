/**
 * Validation Utilities
 *
 * Reusable validation functions for security and data integrity
 */

const path = require('path');
const { SECURITY } = require('../constants');

/**
 * Check if a string contains invalid path characters
 *
 * @param {string} str - String to check
 * @returns {boolean} True if string contains invalid characters
 */
function containsInvalidPathChars(str) {
  if (!str || typeof str !== 'string') {
    return true;
  }

  return SECURITY.INVALID_PATH_CHARS.some(char => str.includes(char));
}

/**
 * Validate a project name
 * Prevents directory traversal attacks
 *
 * @param {string} projectName - Project name to validate
 * @returns {boolean} True if valid
 */
function isValidProjectName(projectName) {
  if (!projectName || typeof projectName !== 'string') {
    return false;
  }

  // Reject names with path traversal characters
  if (containsInvalidPathChars(projectName)) {
    return false;
  }

  // Reject names that start with dots (hidden directories)
  if (projectName.startsWith('.')) {
    return false;
  }

  // Must be alphanumeric with hyphens/underscores only
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  return validPattern.test(projectName);
}

/**
 * Validate a job name
 * Prevents directory traversal attacks
 *
 * @param {string} jobName - Job name to validate
 * @returns {boolean} True if valid
 */
function isValidJobName(jobName) {
  if (!jobName || typeof jobName !== 'string') {
    return false;
  }

  // Reject names with path traversal characters
  if (containsInvalidPathChars(jobName)) {
    return false;
  }

  // Reject names that start with dots (hidden files)
  if (jobName.startsWith('.')) {
    return false;
  }

  // Must be alphanumeric with hyphens/underscores only
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  return validPattern.test(jobName);
}

/**
 * Sanitize a path to prevent directory traversal
 * Ensures the resolved path stays within the base directory
 *
 * @param {string} basePath - Base directory that the path should stay within
 * @param {...string} segments - Path segments to join
 * @returns {string|null} Sanitized path or null if invalid
 */
function sanitizePath(basePath, ...segments) {
  try {
    // Join all segments
    const fullPath = path.join(basePath, ...segments);

    // Resolve to absolute path
    const resolvedPath = path.resolve(fullPath);
    const resolvedBase = path.resolve(basePath);

    // Ensure resolved path starts with base path
    if (!resolvedPath.startsWith(resolvedBase)) {
      return null;
    }

    return resolvedPath;
  } catch (error) {
    return null;
  }
}

/**
 * Validate that a path is within a base directory
 *
 * @param {string} targetPath - Path to validate
 * @param {string} basePath - Base directory
 * @returns {boolean} True if path is within base directory
 */
function isPathWithinBase(targetPath, basePath) {
  try {
    const resolvedPath = path.resolve(targetPath);
    const resolvedBase = path.resolve(basePath);

    return resolvedPath.startsWith(resolvedBase);
  } catch (error) {
    return false;
  }
}

/**
 * Validate an email address format
 *
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

/**
 * Validate a port number
 *
 * @param {number|string} port - Port to validate
 * @returns {boolean} True if valid port
 */
function isValidPort(port) {
  const portNum = parseInt(port, 10);
  return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
}

/**
 * Check if a string is empty or whitespace only
 *
 * @param {string} str - String to check
 * @returns {boolean} True if empty or whitespace
 */
function isEmpty(str) {
  return !str || (typeof str === 'string' && str.trim().length === 0);
}

module.exports = {
  containsInvalidPathChars,
  isValidProjectName,
  isValidJobName,
  sanitizePath,
  isPathWithinBase,
  isValidEmail,
  isValidPort,
  isEmpty
};
