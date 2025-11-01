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

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Generate server keys
```bash
node scripts/generateKeys.js server
```

This creates:
- `keys/server_public.pem` - Server's public key
- `keys/server_private.pem` - Server's private key (keep secure!)

### 3. Create a project
```bash
mkdir -p jobs/my-project
```

### 4. Create jobs for the project
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

### 5. Generate client keys
```bash
node scripts/generateKeys.js my-project-client
```

This creates client keypair in `keys/` directory.

### 6. Authorize the client
```bash
node scripts/addAuthorizedKey.js ./keys/my-project-client_public.pem "My Project CI"
```

### 7. Assign client to project
```bash
node scripts/manageClientProjects.js assign \
  ./keys/my-project-client_public.pem \
  "my-project" \
  "My Project CI/CD Pipeline"
```

### 8. Start the server
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

### List all projects and their jobs
```bash
node scripts/manageClientProjects.js list-projects
```

### List all configured clients
```bash
node scripts/manageClientProjects.js list-clients
```

### Assign client to project
```bash
node scripts/manageClientProjects.js assign \
  <key_file> <project_name> <description>
```

### Remove client assignment
```bash
node scripts/manageClientProjects.js remove <key_file>
```

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

Now:
- `frontend-ci` can only run jobs in `jobs/frontend/`
- `backend-ci` can only run jobs in `jobs/backend/`
- Complete isolation between projects

## Troubleshooting

### Client gets "No project assigned"
- Run `node scripts/manageClientProjects.js list-clients` to verify assignment
- Assign client: `node scripts/manageClientProjects.js assign <key> <project> "desc"`

### Client gets "Not authorized for project"
- Client is trying to access a different project than assigned
- Check assigned project: `node scripts/manageClientProjects.js list-clients`
- Update request to use correct project name

### Job not found
- List available jobs: `node scripts/manageClientProjects.js list-projects`
- Ensure job script exists: `ls jobs/<project>/<job>.sh`
- Make sure script is executable: `chmod +x jobs/<project>/<job>.sh`

## Contributing

See `SETUP_EXAMPLE.md` for a complete walkthrough of setting up a new project.
