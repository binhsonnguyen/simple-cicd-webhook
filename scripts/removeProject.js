#!/usr/bin/env node

/**
 * Interactive Project Removal Script
 *
 * Removes a project:
 * - Deletes project directory from jobs/
 * - Removes client-to-project assignments
 * - Optionally removes keys and authorized_keys entries
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { getAvailableProjects, loadClientProjects, removeClientAssignment } = require('../utils/projectManager');

const JOBS_DIR = path.join(__dirname, '../jobs');
const CLIENT_PROJECTS_FILE = path.join(__dirname, '../config/client_projects.json');
const AUTHORIZED_KEYS_FILE = path.join(__dirname, '../config/authorized_keys.txt');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify question
function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

/**
 * Get clients assigned to a project
 */
function getProjectClients(projectName) {
  const clientProjects = loadClientProjects();
  const clients = [];

  for (const [clientKey, info] of Object.entries(clientProjects.clients || {})) {
    if (info.project === projectName) {
      clients.push({
        key: clientKey,
        description: info.description
      });
    }
  }

  return clients;
}

/**
 * Recursively delete directory
 */
function deleteDirRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  fs.readdirSync(dirPath).forEach((file) => {
    const curPath = path.join(dirPath, file);
    if (fs.lstatSync(curPath).isDirectory()) {
      deleteDirRecursive(curPath);
    } else {
      fs.unlinkSync(curPath);
    }
  });

  fs.rmdirSync(dirPath);
}

/**
 * Remove client key from authorized_keys.txt
 */
function removeFromAuthorizedKeys(clientKey) {
  if (!fs.existsSync(AUTHORIZED_KEYS_FILE)) {
    return false;
  }

  const content = fs.readFileSync(AUTHORIZED_KEYS_FILE, 'utf8');
  const lines = content.split('\n');
  const newLines = [];
  let removed = false;
  let skipNext = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip if this is the key we're looking for
    if (line.trim() === clientKey.trim()) {
      removed = true;
      // Also remove the comment line before it if it exists
      if (newLines.length > 0 && newLines[newLines.length - 1].startsWith('#')) {
        newLines.pop();
      }
      continue;
    }

    newLines.push(line);
  }

  if (removed) {
    fs.writeFileSync(AUTHORIZED_KEYS_FILE, newLines.join('\n'));
  }

  return removed;
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('REMOVE PROJECT');
  console.log('='.repeat(60));
  console.log();

  try {
    // Load client projects
    loadClientProjects();

    // Get available projects
    const projects = getAvailableProjects();

    if (projects.length === 0) {
      console.log('No projects found.');
      rl.close();
      return;
    }

    console.log('Available projects:');
    projects.forEach((proj, idx) => {
      const clients = getProjectClients(proj);
      console.log(`  ${idx + 1}. ${proj} (${clients.length} client${clients.length !== 1 ? 's' : ''})`);
    });
    console.log();

    // Get project to remove
    let projectName;
    while (true) {
      const answer = await question('Enter project name or number to remove (or "cancel"): ');
      const input = answer.trim();

      if (input.toLowerCase() === 'cancel') {
        console.log('Cancelled.');
        rl.close();
        return;
      }

      // Check if it's a number
      const num = parseInt(input);
      if (!isNaN(num) && num >= 1 && num <= projects.length) {
        projectName = projects[num - 1];
        break;
      }

      // Check if it's a project name
      if (projects.includes(input)) {
        projectName = input;
        break;
      }

      console.log('Invalid project. Please try again.\n');
    }

    // Get clients assigned to this project
    const clients = getProjectClients(projectName);

    console.log();
    console.log('='.repeat(60));
    console.log(`Project: ${projectName}`);
    console.log('='.repeat(60));
    console.log();

    if (clients.length > 0) {
      console.log('Assigned clients:');
      clients.forEach((client, idx) => {
        console.log(`  ${idx + 1}. ${client.description}`);
        console.log(`     Key: ${client.key.substring(0, 50)}...`);
      });
      console.log();
    } else {
      console.log('No clients assigned to this project.');
      console.log();
    }

    // Count job scripts
    const projectDir = path.join(JOBS_DIR, projectName);
    let jobCount = 0;
    if (fs.existsSync(projectDir)) {
      const files = fs.readdirSync(projectDir);
      jobCount = files.filter(f => f.endsWith('.sh')).length;
    }

    console.log('What will be removed:');
    console.log(`  ✗ Project directory: jobs/${projectName}/`);
    if (jobCount > 0) {
      console.log(`  ✗ ${jobCount} job script${jobCount !== 1 ? 's' : ''}`);
    }
    if (clients.length > 0) {
      console.log(`  ✗ ${clients.length} client assignment${clients.length !== 1 ? 's' : ''}`);
    }
    console.log();

    // Confirm deletion
    console.log('⚠️  WARNING: This action cannot be undone!');
    console.log();
    const confirm = await question(`Type "${projectName}" to confirm deletion: `);

    if (confirm !== projectName) {
      console.log('Confirmation failed. Cancelled.');
      rl.close();
      return;
    }

    // Ask about removing keys from authorized_keys.txt
    let removeKeys = false;
    if (clients.length > 0) {
      console.log();
      const removeKeysAnswer = await question('Remove client keys from authorized_keys.txt? (yes/no): ');
      removeKeys = removeKeysAnswer.toLowerCase() === 'yes' || removeKeysAnswer.toLowerCase() === 'y';
    }

    console.log();
    console.log('Removing project...');
    console.log();

    // Step 1: Remove project directory
    if (fs.existsSync(projectDir)) {
      deleteDirRecursive(projectDir);
      console.log(`✓ Removed directory: jobs/${projectName}/`);
    }

    // Step 2: Remove client assignments
    let removedCount = 0;
    for (const client of clients) {
      const removed = removeClientAssignment(client.key);
      if (removed) {
        removedCount++;
      }
    }
    if (removedCount > 0) {
      console.log(`✓ Removed ${removedCount} client assignment${removedCount !== 1 ? 's' : ''}`);
    }

    // Step 3: Optionally remove from authorized_keys.txt
    if (removeKeys && clients.length > 0) {
      let keysRemovedCount = 0;
      for (const client of clients) {
        if (removeFromAuthorizedKeys(client.key)) {
          keysRemovedCount++;
        }
      }
      if (keysRemovedCount > 0) {
        console.log(`✓ Removed ${keysRemovedCount} key${keysRemovedCount !== 1 ? 's' : ''} from authorized_keys.txt`);
      }
    }

    // Success summary
    console.log();
    console.log('='.repeat(60));
    console.log('PROJECT REMOVED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log();
    console.log(`Project "${projectName}" has been removed.`);
    console.log();

    if (!removeKeys && clients.length > 0) {
      console.log('Note: Client keys are still in authorized_keys.txt');
      console.log('      Remove them manually if needed.');
      console.log();
    }

  } catch (error) {
    console.error('\nError:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle Ctrl+C gracefully
rl.on('SIGINT', () => {
  console.log('\n\nCancelled.');
  process.exit(0);
});

// Run main function
main();
