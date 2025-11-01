#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { setClientPermissions, getAllowedJobs, getAvailableJobs } = require('../utils/jobManager');

/**
 * CLI tool to manage job permissions for clients
 * Usage: node scripts/manageJobPermissions.js <command> [args...]
 */

const PERMISSIONS_FILE = path.join(__dirname, '../config/job_permissions.json');

function loadPermissionsFile() {
  if (!fs.existsSync(PERMISSIONS_FILE)) {
    return { permissions: {}, defaultPermissions: { enabled: false, allowedJobs: [] } };
  }
  return JSON.parse(fs.readFileSync(PERMISSIONS_FILE, 'utf8'));
}

function savePermissionsFile(data) {
  fs.writeFileSync(PERMISSIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function listClients() {
  const data = loadPermissionsFile();
  const permissions = data.permissions || {};

  console.log('\nConfigured Clients:');
  console.log('===================\n');

  const clients = Object.keys(permissions);
  if (clients.length === 0) {
    console.log('No clients configured.');
    return;
  }

  clients.forEach((key, index) => {
    const client = permissions[key];
    console.log(`${index + 1}. ${client.description || 'Unnamed client'}`);
    console.log(`   Key: ${key.substring(0, 60)}...`);
    console.log(`   Allowed jobs: ${client.allowedJobs.join(', ') || 'none'}`);
    console.log('');
  });
}

function addPermissions(keyFile, jobs, description) {
  if (!keyFile) {
    console.error('Error: Public key file path required');
    process.exit(1);
  }

  if (!fs.existsSync(keyFile)) {
    console.error(`Error: Key file not found: ${keyFile}`);
    process.exit(1);
  }

  const publicKey = fs.readFileSync(keyFile, 'utf8').trim();
  const jobList = jobs ? jobs.split(',').map(j => j.trim()) : [];

  // Validate jobs exist
  const availableJobs = getAvailableJobs();
  const invalidJobs = jobList.filter(j => !availableJobs.includes(j));

  if (invalidJobs.length > 0) {
    console.error(`Error: Invalid jobs: ${invalidJobs.join(', ')}`);
    console.log(`\nAvailable jobs: ${availableJobs.join(', ')}`);
    process.exit(1);
  }

  setClientPermissions(publicKey, jobList, description);
  console.log('\n✓ Permissions updated successfully');
  console.log(`  Client: ${description}`);
  console.log(`  Allowed jobs: ${jobList.join(', ')}`);
}

function removePermissions(keyFile) {
  if (!keyFile) {
    console.error('Error: Public key file path required');
    process.exit(1);
  }

  if (!fs.existsSync(keyFile)) {
    console.error(`Error: Key file not found: ${keyFile}`);
    process.exit(1);
  }

  const publicKey = fs.readFileSync(keyFile, 'utf8').trim();
  const data = loadPermissionsFile();

  if (!data.permissions[publicKey]) {
    console.error('Error: Client not found in permissions');
    process.exit(1);
  }

  delete data.permissions[publicKey];
  savePermissionsFile(data);

  console.log('\n✓ Permissions removed successfully');
}

function listJobs() {
  const availableJobs = getAvailableJobs();

  console.log('\nAvailable Jobs:');
  console.log('===============\n');

  if (availableJobs.length === 0) {
    console.log('No jobs found in jobs/ directory');
    return;
  }

  availableJobs.forEach((job, index) => {
    const jobPath = path.join(__dirname, '../jobs', `${job}.sh`);
    const content = fs.readFileSync(jobPath, 'utf8');

    // Extract description from comment
    const descMatch = content.match(/# Description: (.+)/);
    const description = descMatch ? descMatch[1] : 'No description';

    console.log(`${index + 1}. ${job}`);
    console.log(`   ${description}`);
    console.log('');
  });
}

// Main CLI
const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log('Job Permissions Manager');
  console.log('=======================\n');
  console.log('Usage: node scripts/manageJobPermissions.js <command> [args...]\n');
  console.log('Commands:');
  console.log('  list-clients              List all configured clients');
  console.log('  list-jobs                 List all available jobs');
  console.log('  add <key_file> <jobs> <description>');
  console.log('                            Add or update client permissions');
  console.log('                            jobs: comma-separated list (e.g., "deploy-staging,run-tests")');
  console.log('  remove <key_file>         Remove client permissions');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/manageJobPermissions.js list-jobs');
  console.log('  node scripts/manageJobPermissions.js list-clients');
  console.log('  node scripts/manageJobPermissions.js add ./keys/client1_public.pem "deploy-staging,run-tests" "GitLab CI Staging"');
  console.log('  node scripts/manageJobPermissions.js remove ./keys/client1_public.pem');
  process.exit(0);
}

switch (command) {
  case 'list-clients':
    listClients();
    break;

  case 'list-jobs':
    listJobs();
    break;

  case 'add':
    const keyFile = args[1];
    const jobs = args[2];
    const description = args[3] || 'Unnamed client';
    addPermissions(keyFile, jobs, description);
    break;

  case 'remove':
    removePermissions(args[1]);
    break;

  default:
    console.error(`Unknown command: ${command}`);
    console.log('Run without arguments to see usage');
    process.exit(1);
}
