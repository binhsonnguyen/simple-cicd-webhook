/**
 * Job Executor Service
 *
 * Handles the execution of job scripts
 * Separated from projectManager for better separation of concerns
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { PATHS } = require('../constants');
const { sanitizePath } = require('./validators');
const { JobExecutionError } = require('./errors');

const JOBS_DIR = path.join(__dirname, '..', PATHS.JOBS_DIR);

/**
 * Check if a job script exists
 *
 * @param {string} projectName - Project name
 * @param {string} jobName - Job name
 * @returns {boolean} True if job exists
 */
function jobScriptExists(projectName, jobName) {
  if (!projectName || !jobName) {
    return false;
  }

  const jobPath = sanitizePath(JOBS_DIR, projectName, `${jobName}.sh`);

  if (!jobPath) {
    return false; // Path traversal detected
  }

  return fs.existsSync(jobPath);
}

/**
 * Execute a job for a project
 *
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
    if (!jobScriptExists(projectName, jobName)) {
      return reject(new JobExecutionError(
        `Job not found: ${projectName}/${jobName}`,
        jobName
      ));
    }

    const jobPath = sanitizePath(JOBS_DIR, projectName, `${jobName}.sh`);
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
        const error = new JobExecutionError(
          `Job failed with exit code ${exitCode}`,
          jobName,
          exitCode,
          stderr
        );
        // Attach result to error
        Object.assign(error, result);
        reject(error);
      }
    });

    // Handle process errors
    jobProcess.on('error', (error) => {
      const duration = Date.now() - startTime;
      const execError = new JobExecutionError(
        `Job execution error: ${error.message}`,
        jobName
      );

      // Attach additional info
      Object.assign(execError, {
        projectName,
        jobName,
        success: false,
        duration,
        originalError: error.message
      });

      if (options.onComplete) {
        options.onComplete({
          projectName,
          jobName,
          success: false,
          error: error.message,
          duration
        });
      }

      reject(execError);
    });
  });
}

module.exports = {
  jobScriptExists,
  executeJob
};
