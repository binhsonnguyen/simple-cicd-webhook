# GitLab CI/CD Webhook Server

A Node.js webhook server for GitLab CI runners with project-based authentication and job execution.

## Architecture

**Core Concept**: Each client keypair is bound to ONE project. Clients authenticate with their key and can only execute jobs within their assigned project.

```
Client Keypair → Project → Jobs
```

- **Client**: GitLab CI runner with a unique public/private keypair
- **Project**: A collection of CI/CD jobs (e.g., "project-a", "project-b")
- **Jobs**: Shell scripts that perform CI/CD tasks

## Quick Start

The fastest way to get started:

```bash
# 1. Install dependencies
npm install

# 2. Generate server keys
npm run generate-keys server

# 3. Create a new project (interactive)
npm run create-project

# 4. Start the server
npm start
```

That's it! The `create-project` command handles everything: directory creation, keypair generation, authorization, and project assignment.

## Setup

### Option A: Quick Setup (Recommended)

**1. Install dependencies**
```bash
npm install
```

**2. Generate server keys**
```bash
npm run generate-keys server
```

This creates:
- `keys/server_public.pem` - Server's public key
- `keys/server_private.pem` - Server's private key (keep secure!)

**3. Create project interactively**
```bash
npm run create-project
```

This interactive script will:
- ✅ Create project directory in `jobs/`
- ✅ Generate client keypair
- ✅ Add client to authorized keys
- ✅ Assign client to project
- ✅ Create sample job script
- ✅ Show webhook usage example

**4. Start the server**
```bash
npm start
```

### Option B: Manual Setup

If you prefer manual control:

**1. Install dependencies**
```bash
npm install
```

**2. Generate server keys**
```bash
node scripts/generateKeys.js server
```

**3. Create a project**
```bash
mkdir -p jobs/my-project
```

**4. Create jobs for the project**
```bash
cat > jobs/my-project/deploy.sh << 'EOF'
#!/bin/bash
# Job: deploy
# Description: Deploy my-project application

echo "Deploying my-project..."
echo "Environment: ${DEPLOY_ENV:-production}"
# Add your deployment commands here
exit 0
EOF

chmod +x jobs/my-project/deploy.sh
```

**5. Generate client keys**
```bash
node scripts/generateKeys.js my-project-client
```

**6. Authorize the client**
```bash
node scripts/addAuthorizedKey.js ./keys/my-project-client_public.pem "My Project CI"
```

**7. Assign client to project**
```bash
node scripts/manageClientProjects.js assign \
  ./keys/my-project-client_public.pem \
  "my-project" \
  "My Project CI/CD Pipeline"
```

**8. Start the server**
```bash
npm start
```

## Project Structure

```
jobs/
├── project-a/
│   ├── deploy.sh
│   ├── test.sh
│   └── rollback.sh
└── project-b/
    ├── deploy.sh
    └── build.sh
```

Each project directory contains its own jobs. No sharing between projects.

## Usage

### Client Request Format

Clients must include **three parameters**:

1. **token** - Client's public key (for authentication)
2. **project** - Project name (must match assigned project)
3. **job** - Job name to execute

Example request:
```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: $(cat keys/my-project-client_public.pem)" \
  -d '{
    "project": "my-project",
    "job": "deploy"
  }'
```

Response:
```json
{
  "status": "accepted",
  "message": "Job started",
  "project": "my-project",
  "job": "deploy",
  "timestamp": "2025-11-01T..."
}
```

### List Available Jobs

Check what jobs are available for your project:
```bash
curl http://localhost:3000/jobs \
  -H "X-Webhook-Token: $(cat keys/my-project-client_public.pem)"
```

Response:
```json
{
  "status": "ok",
  "project": "my-project",
  "jobs": ["deploy", "test", "rollback"],
  "timestamp": "2025-11-01T..."
}
```

## Management Commands

### Project Management

**Create a new project (interactive)**
```bash
npm run create-project
```

Creates a complete project setup with:
- Project directory and sample job
- Client keypair generation
- Authorization and assignment
- Usage instructions

**Remove a project (interactive)**
```bash
npm run remove-project
```

Safely removes a project:
- Lists all projects
- Shows what will be deleted
- Requires confirmation
- Optionally removes keys from authorized_keys.txt

### Client Management

**List all projects and their jobs**
```bash
npm run manage-projects list-projects
# or
node scripts/manageClientProjects.js list-projects
```

**List all configured clients**
```bash
npm run manage-projects list-clients
# or
node scripts/manageClientProjects.js list-clients
```

**Assign client to project (manual)**
```bash
node scripts/manageClientProjects.js assign \
  <key_file> <project_name> <description>
```

**Remove client assignment (manual)**
```bash
node scripts/manageClientProjects.js remove <key_file>
```

### Testing

**Test webhook with client key**
```bash
npm run test-webhook keys/my-project-client_public.pem
```

**Run unit tests**
```bash
npm test                  # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
```

## Available npm Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the webhook server |
| `npm run dev` | Start in development mode |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |
| `npm run create-project` | **Create new project (interactive)** |
| `npm run remove-project` | **Remove project (interactive)** |
| `npm run manage-projects` | Manage client-project assignments |
| `npm run generate-keys` | Generate RSA keypairs |
| `npm run add-key` | Add client key to authorized keys |
| `npm run test-webhook` | Test webhook with a key |

## GitLab CI Integration

In your `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - deploy

test:
  stage: test
  script:
    - |
      curl -X POST "${WEBHOOK_URL}/webhook" \
        -H "Content-Type: application/json" \
        -H "X-Webhook-Token: ${WEBHOOK_TOKEN}" \
        -d '{"project": "my-project", "job": "test"}'

deploy:
  stage: deploy
  script:
    - |
      curl -X POST "${WEBHOOK_URL}/webhook" \
        -H "Content-Type: application/json" \
        -H "X-Webhook-Token: ${WEBHOOK_TOKEN}" \
        -d '{"project": "my-project", "job": "deploy"}'
  only:
    - main
```

**GitLab CI/CD Variables:**
- `WEBHOOK_URL` - Your webhook server URL (e.g., `https://your-server.com`)
- `WEBHOOK_TOKEN` - Client's public key (mark as protected and masked)

## API Endpoints

- `GET /health` - Health check (no auth)
- `GET /public-key` - Fetch server public key (no auth)
- `GET /jobs` - List jobs for client's project (requires auth)
- `POST /webhook` - Execute job (requires auth + project + job params)
- `POST /admin/reload-keys` - Reload authorized keys (requires auth)

## Security Model

### Authentication Flow

1. **Client sends request** with token (public key) + project + job
2. **Server validates token** against `config/authorized_keys.txt`
3. **Server checks project assignment** in `config/client_projects.json`
4. **Server validates requested project** matches assigned project
5. **Server validates job exists** in `jobs/<project>/<job>.sh`
6. **Server executes job** if all checks pass

### Security Features

- ✅ Public/private key authentication
- ✅ Project-based access control
- ✅ Path traversal prevention
- ✅ Job validation before execution
- ✅ Comprehensive request logging
- ✅ Private keys with restricted permissions (600)

### What's Protected

- **Cross-project access**: Client for project-a cannot run jobs in project-b
- **Unauthorized jobs**: Only jobs in assigned project can be executed
- **Directory traversal**: Cannot escape project directory
- **Unauthenticated access**: All job execution requires valid keypair

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)
- `SERVER_PUBLIC_KEY_PATH` - Path to server's public key
- `SERVER_PRIVATE_KEY_PATH` - Path to server's private key
- `AUTHORIZED_KEYS_PATH` - Path to authorized client keys

## Logging

All requests and job executions are logged to:
- Console output (with colors)
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

Job execution logs include:
- Client key (partial)
- Project name
- Job name
- Execution status
- Duration
- Output (stdout/stderr)

## Example: Multi-Project Setup

### Quick Method (Recommended)

```bash
# Create frontend project
npm run create-project
# Enter: frontend
# Description: Frontend deployment
# Key name: (press Enter for default)

# Create backend project
npm run create-project
# Enter: backend
# Description: Backend deployment
# Key name: (press Enter for default)

# Start server
npm start
```

Now:
- `frontend-client` can only run jobs in `jobs/frontend/`
- `backend-client` can only run jobs in `jobs/backend/`
- Complete isolation between projects

### Manual Method

If you need more control:

```bash
# Create two projects
mkdir -p jobs/frontend jobs/backend

# Create jobs
echo '#!/bin/bash
echo "Deploying frontend..."' > jobs/frontend/deploy.sh
chmod +x jobs/frontend/deploy.sh

echo '#!/bin/bash
echo "Deploying backend..."' > jobs/backend/deploy.sh
chmod +x jobs/backend/deploy.sh

# Generate client keys
node scripts/generateKeys.js frontend-ci
node scripts/generateKeys.js backend-ci

# Authorize clients
node scripts/addAuthorizedKey.js ./keys/frontend-ci_public.pem "Frontend CI"
node scripts/addAuthorizedKey.js ./keys/backend-ci_public.pem "Backend CI"

# Assign to projects
node scripts/manageClientProjects.js assign ./keys/frontend-ci_public.pem "frontend" "Frontend CI"
node scripts/manageClientProjects.js assign ./keys/backend-ci_public.pem "backend" "Backend CI"
```

## Troubleshooting

### Client gets "No project assigned"
**Cause**: Client key has not been assigned to any project

**Solution**:
```bash
# Check current assignments
npm run manage-projects list-clients

# Option 1: Use interactive project creation
npm run create-project

# Option 2: Manually assign existing key
node scripts/manageClientProjects.js assign <key_file> <project> "description"
```

### Client gets "Not authorized for project"
**Cause**: Client is trying to access a different project than assigned

**Solution**:
```bash
# Check which project the client is assigned to
npm run manage-projects list-clients

# Update your request to use the correct project name
# Or reassign the client to the desired project
```

### Job not found
**Cause**: Job script doesn't exist or isn't executable

**Solution**:
```bash
# List all available jobs
npm run manage-projects list-projects

# Verify job script exists
ls jobs/<project>/<job>.sh

# Make script executable
chmod +x jobs/<project>/<job>.sh

# Or create a new job script in the project directory
```

### Environment validation failed
**Cause**: Required directories or configuration files missing

**Solution**:
```bash
# Create required directories
mkdir -p jobs config keys logs

# Generate server keys if missing
npm run generate-keys server

# Create at least one project
npm run create-project
```

### Want to start fresh?
**Remove a project completely**:
```bash
npm run remove-project
# Select project to remove
# Confirm deletion
# Choose whether to remove keys from authorized_keys.txt
```

## Contributing

See `SETUP_EXAMPLE.md` for a complete walkthrough of setting up a new project.
