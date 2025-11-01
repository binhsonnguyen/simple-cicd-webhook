#!/usr/bin/env node

/**
 * Interactive Project Creation Script
 *
 * Creates a new project with:
 * - Project directory in jobs/
 * - Client keypair
 * - Client-to-project assignment
 * - Adds public key to authorized_keys.txt
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { generateKeyPair, saveKeyPair } = require('../utils/keyManager');
const { assignClientToProject, getAvailableProjects } = require('../utils/projectManager');
const { isValidProjectName } = require('../utils/validators');

const JOBS_DIR = path.join(__dirname, '../jobs');
const KEYS_DIR = path.join(__dirname, '../keys');
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
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('CREATE NEW PROJECT');
  console.log('='.repeat(60));
  console.log();

  try {
    // Get project name
    let projectName;
    while (true) {
      projectName = await question('Project name (alphanumeric, hyphens, underscores): ');
      projectName = projectName.trim();

      if (!projectName) {
        console.log('Error: Project name cannot be empty\n');
        continue;
      }

      if (!isValidProjectName(projectName)) {
        console.log('Error: Invalid project name. Use only letters, numbers, hyphens, and underscores\n');
        continue;
      }

      // Check if project already exists
      const existingProjects = getAvailableProjects();
      if (existingProjects.includes(projectName)) {
        console.log(`Error: Project "${projectName}" already exists\n`);
        continue;
      }

      break;
    }

    // Get description
    const description = await question('Project description (optional): ');

    // Get client key name
    let clientKeyName = await question(`Client key name [default: ${projectName}-client]: `);
    clientKeyName = clientKeyName.trim() || `${projectName}-client`;

    console.log();
    console.log('Summary:');
    console.log(`  Project: ${projectName}`);
    console.log(`  Description: ${description || '(none)'}`);
    console.log(`  Client key: ${clientKeyName}`);
    console.log();

    const confirm = await question('Create this project? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      rl.close();
      return;
    }

    console.log();
    console.log('Creating project...');
    console.log();

    // Step 1: Create project directory
    const projectDir = path.join(JOBS_DIR, projectName);
    fs.mkdirSync(projectDir, { recursive: true });
    console.log(`✓ Created directory: jobs/${projectName}/`);

    // Create a sample job script
    const sampleJobPath = path.join(projectDir, 'deploy.sh');
    const sampleJobContent = `#!/bin/bash
# Sample deployment script for ${projectName}
# Project: ${projectName}
${description ? `# Description: ${description}` : ''}

echo "Starting deployment for ${projectName}..."
echo "Project: $PROJECT_NAME"
echo "Job: $JOB_NAME"
echo "Started at: $JOB_START_TIME"

# Add your deployment commands here
echo "Deployment completed successfully!"
`;

    fs.writeFileSync(sampleJobPath, sampleJobContent, { mode: 0o755 });
    console.log(`✓ Created sample job: jobs/${projectName}/deploy.sh`);

    // Step 2: Generate client keypair
    console.log('\nGenerating client keypair...');
    const keyPair = generateKeyPair();

    // Ensure keys directory exists
    if (!fs.existsSync(KEYS_DIR)) {
      fs.mkdirSync(KEYS_DIR, { recursive: true });
    }

    const keyPath = path.join(KEYS_DIR, clientKeyName);
    saveKeyPair(keyPair, keyPath);
    console.log(`✓ Generated keypair: keys/${clientKeyName}_public.pem`);
    console.log(`                     keys/${clientKeyName}_private.pem`);

    // Step 3: Add public key to authorized_keys.txt
    const publicKeyPath = `${keyPath}_public.pem`;
    const publicKey = fs.readFileSync(publicKeyPath, 'utf8').trim();

    // Ensure authorized_keys.txt exists
    if (!fs.existsSync(AUTHORIZED_KEYS_FILE)) {
      fs.mkdirSync(path.dirname(AUTHORIZED_KEYS_FILE), { recursive: true });
      fs.writeFileSync(AUTHORIZED_KEYS_FILE, '');
    }

    // Add to authorized keys with comment
    const comment = `# ${projectName} - ${description || clientKeyName}`;
    const entry = `\n${comment}\n${publicKey}\n`;
    fs.appendFileSync(AUTHORIZED_KEYS_FILE, entry);
    console.log(`✓ Added public key to authorized_keys.txt`);

    // Step 4: Assign client to project
    assignClientToProject(publicKey, projectName, description || `${projectName} client`);
    console.log(`✓ Assigned client to project: ${projectName}`);

    // Success summary
    console.log();
    console.log('='.repeat(60));
    console.log('PROJECT CREATED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log();
    console.log('Project Details:');
    console.log(`  Name: ${projectName}`);
    console.log(`  Directory: jobs/${projectName}/`);
    console.log(`  Sample job: jobs/${projectName}/deploy.sh`);
    console.log();
    console.log('Client Credentials:');
    console.log(`  Public key: keys/${clientKeyName}_public.pem`);
    console.log(`  Private key: keys/${clientKeyName}_private.pem`);
    console.log();
    console.log('Next Steps:');
    console.log(`  1. Add your job scripts to: jobs/${projectName}/`);
    console.log(`  2. Make job scripts executable: chmod +x jobs/${projectName}/*.sh`);
    console.log(`  3. Share the public key with the client`);
    console.log(`  4. Test the webhook with: npm run test-webhook keys/${clientKeyName}_public.pem`);
    console.log();
    console.log('Webhook Request Example:');
    console.log(`  curl -X POST http://localhost:3000/webhook \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -H "X-Webhook-Token: $(cat keys/${clientKeyName}_public.pem)" \\`);
    console.log(`    -d '{"project": "${projectName}", "job": "deploy"}'`);
    console.log();

  } catch (error) {
    console.error('\nError:', error.message);
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
