#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  assignClientToProject,
  removeClientAssignment,
  getClientProject,
  getAvailableProjects,
  getProjectJobs
} = require('../utils/projectManager');

/**
 * CLI tool to manage client-to-project assignments
 * Usage: node scripts/manageClientProjects.js <command> [args...]
 */

const CLIENT_PROJECTS_FILE = path.join(__dirname, '../config/client_projects.json');

function loadClientsFile() {
  if (!fs.existsSync(CLIENT_PROJECTS_FILE)) {
    return { clients: {} };
  }
  return JSON.parse(fs.readFileSync(CLIENT_PROJECTS_FILE, 'utf8'));
}

function listClients() {
  const data = loadClientsFile();
  const clients = data.clients || {};

  console.log('\nConfigured Clients:');
  console.log('===================\n');

  const clientKeys = Object.keys(clients);
  if (clientKeys.length === 0) {
    console.log('No clients configured.');
    return;
  }

  clientKeys.forEach((key, index) => {
    const client = clients[key];
    console.log(`${index + 1}. ${client.description || 'Unnamed client'}`);
    console.log(`   Project: ${client.project}`);
    console.log(`   Key: ${key.substring(0, 60)}...`);
    console.log('');
  });
}

function listProjects() {
  const projects = getAvailableProjects();

  console.log('\nAvailable Projects:');
  console.log('===================\n');

  if (projects.length === 0) {
    console.log('No projects found in jobs/ directory');
    console.log('Create a project: mkdir -p jobs/my-project');
    return;
  }

  projects.forEach((project, index) => {
    const jobs = getProjectJobs(project);

    console.log(`${index + 1}. ${project}/`);
    console.log(`   Jobs: ${jobs.length > 0 ? jobs.join(', ') : 'none'}`);

    jobs.forEach(job => {
      const jobPath = path.join(__dirname, '../jobs', project, `${job}.sh`);
      try {
        const content = fs.readFileSync(jobPath, 'utf8');
        const descMatch = content.match(/# Description: (.+)/);
        if (descMatch) {
          console.log(`     - ${job}: ${descMatch[1]}`);
        }
      } catch (error) {
        // Ignore read errors
      }
    });

    console.log('');
  });
}

function assignClient(keyFile, projectName, description) {
  if (!keyFile || !projectName) {
    console.error('Error: Both key file and project name required');
    process.exit(1);
  }

  if (!fs.existsSync(keyFile)) {
    console.error(`Error: Key file not found: ${keyFile}`);
    process.exit(1);
  }

  // Validate project exists
  const availableProjects = getAvailableProjects();
  if (!availableProjects.includes(projectName)) {
    console.error(`Error: Project not found: ${projectName}`);
    console.log(`\nAvailable projects: ${availableProjects.join(', ')}`);
    console.log('\nCreate a new project:');
    console.log(`  mkdir -p jobs/${projectName}`);
    process.exit(1);
  }

  const publicKey = fs.readFileSync(keyFile, 'utf8').trim();

  assignClientToProject(publicKey, projectName, description);
  console.log('\n✓ Client assigned to project successfully');
  console.log(`  Client: ${description}`);
  console.log(`  Project: ${projectName}`);

  const jobs = getProjectJobs(projectName);
  console.log(`  Available jobs: ${jobs.join(', ') || 'none'}`);
}

function removeClient(keyFile) {
  if (!keyFile) {
    console.error('Error: Public key file path required');
    process.exit(1);
  }

  if (!fs.existsSync(keyFile)) {
    console.error(`Error: Key file not found: ${keyFile}`);
    process.exit(1);
  }

  const publicKey = fs.readFileSync(keyFile, 'utf8').trim();

  if (removeClientAssignment(publicKey)) {
    console.log('\n✓ Client assignment removed successfully');
  } else {
    console.error('Error: Client not found');
    process.exit(1);
  }
}

// Main CLI
const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log('Client-Project Manager');
  console.log('======================\n');
  console.log('Usage: node scripts/manageClientProjects.js <command> [args...]\n');
  console.log('Commands:');
  console.log('  list-clients              List all configured clients');
  console.log('  list-projects             List all available projects');
  console.log('  assign <key_file> <project> <description>');
  console.log('                            Assign a client to a project');
  console.log('  remove <key_file>         Remove client assignment');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/manageClientProjects.js list-projects');
  console.log('  node scripts/manageClientProjects.js list-clients');
  console.log('  node scripts/manageClientProjects.js assign ./keys/client1_public.pem "project-a" "Project A CI"');
  console.log('  node scripts/manageClientProjects.js remove ./keys/client1_public.pem');
  console.log('');
  console.log('Project Structure:');
  console.log('  jobs/');
  console.log('  ├── project-a/');
  console.log('  │   ├── deploy.sh');
  console.log('  │   └── test.sh');
  console.log('  └── project-b/');
  console.log('      └── deploy.sh');
  process.exit(0);
}

switch (command) {
  case 'list-clients':
    listClients();
    break;

  case 'list-projects':
    listProjects();
    break;

  case 'assign':
    const keyFile = args[1];
    const projectName = args[2];
    const description = args[3] || 'Unnamed client';
    assignClient(keyFile, projectName, description);
    break;

  case 'remove':
    removeClient(args[1]);
    break;

  default:
    console.error(`Unknown command: ${command}`);
    console.log('Run without arguments to see usage');
    process.exit(1);
}
