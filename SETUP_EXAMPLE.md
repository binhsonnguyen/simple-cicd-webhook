# Complete Setup Example

This guide demonstrates setting up two projects with separate CI/CD pipelines.

## Overview

We'll create:
- **project-a**: A web application
- **project-b**: An API service

Each project has its own client keypair and can only execute its own jobs.

## Step 1: Install and Generate Server Keys

```bash
# Install dependencies
npm install

# Generate server keys
node scripts/generateKeys.js server
# Output: keys/server_public.pem and keys/server_private.pem created
```

## Step 2: Create Projects

```bash
# Create project directories
mkdir -p jobs/project-a jobs/project-b

# Create jobs for Project A
cat > jobs/project-a/deploy.sh << 'EOF'
#!/bin/bash
# Job: deploy
# Description: Deploy Project A web application

echo "=== Deploying Project A ==="
echo "Environment: ${DEPLOY_ENV:-production}"
echo "Building..."
# npm run build
echo "Deploying..."
# rsync -avz dist/ server:/var/www/project-a/
echo "✓ Project A deployed successfully"
exit 0
EOF

cat > jobs/project-a/test.sh << 'EOF'
#!/bin/bash
# Job: test
# Description: Run Project A test suite

echo "=== Running Project A Tests ==="
# npm test
echo "✓ Tests passed"
exit 0
EOF

# Create jobs for Project B
cat > jobs/project-b/deploy.sh << 'EOF'
#!/bin/bash
# Job: deploy
# Description: Deploy Project B API service

echo "=== Deploying Project B API ==="
echo "Environment: ${DEPLOY_ENV:-production}"
echo "Building Docker image..."
# docker build -t project-b-api:latest .
echo "Deploying to Kubernetes..."
# kubectl apply -f k8s/
echo "✓ Project B API deployed successfully"
exit 0
EOF

# Make scripts executable
chmod +x jobs/project-a/*.sh jobs/project-b/*.sh
```

## Step 3: Generate Client Keys

```bash
# Generate keypair for Project A CI
node scripts/generateKeys.js project-a-ci
# Output: keys/project-a-ci_public.pem and keys/project-a-ci_private.pem

# Generate keypair for Project B CI
node scripts/generateKeys.js project-b-ci
# Output: keys/project-b-ci_public.pem and keys/project-b-ci_private.pem
```

## Step 4: Authorize Clients

```bash
# Add Project A client to authorized keys
node scripts/addAuthorizedKey.js ./keys/project-a-ci_public.pem "Project A CI Pipeline"
# Output: ✓ Key successfully added

# Add Project B client to authorized keys
node scripts/addAuthorizedKey.js ./keys/project-b-ci_public.pem "Project B CI Pipeline"
# Output: ✓ Key successfully added
```

## Step 5: Assign Clients to Projects

```bash
# Assign Project A client to project-a
node scripts/manageClientProjects.js assign \
  ./keys/project-a-ci_public.pem \
  "project-a" \
  "Project A Web Application CI"
# Output: ✓ Client assigned to project successfully
#   Project: project-a
#   Available jobs: deploy, test

# Assign Project B client to project-b
node scripts/manageClientProjects.js assign \
  ./keys/project-b-ci_public.pem \
  "project-b" \
  "Project B API Service CI"
# Output: ✓ Client assigned to project successfully
#   Project: project-b
#   Available jobs: deploy

# Verify assignments
node scripts/manageClientProjects.js list-clients
```

## Step 6: Start the Server

```bash
npm start
# Output: Webhook server started on port 3000
```

## Step 7: Test the Setup

In another terminal:

```bash
# Test Project A
PROJECT_A_KEY=$(cat keys/project-a-ci_public.pem)

# List Project A jobs
curl http://localhost:3000/jobs \
  -H "X-Webhook-Token: $PROJECT_A_KEY"

# Expected response:
# {
#   "status": "ok",
#   "project": "project-a",
#   "jobs": ["deploy", "test"]
# }

# Run Project A deployment
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: $PROJECT_A_KEY" \
  -d '{"project": "project-a", "job": "deploy"}'

# Expected response:
# {
#   "status": "accepted",
#   "message": "Job started",
#   "project": "project-a",
#   "job": "deploy",
#   "timestamp": "..."
# }

# Test Project B
PROJECT_B_KEY=$(cat keys/project-b-ci_public.pem)

curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: $PROJECT_B_KEY" \
  -d '{"project": "project-b", "job": "deploy"}'
```

## Step 8: Test Security

```bash
# Try to access wrong project (should fail)
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Token: $PROJECT_A_KEY" \
  -d '{"project": "project-b", "job": "deploy"}'

# Expected response:
# {
#   "status": "error",
#   "message": "Not authorized for project: project-b",
#   "assignedProject": "project-a"
# }
```

## Step 9: Configure GitLab CI

### For Project A Repository

In `project-a/.gitlab-ci.yml`:

```yaml
stages:
  - test
  - deploy

variables:
  PROJECT_NAME: "project-a"

run-tests:
  stage: test
  script:
    - |
      curl -X POST "${WEBHOOK_URL}/webhook" \
        -H "Content-Type: application/json" \
        -H "X-Webhook-Token: ${WEBHOOK_TOKEN}" \
        -d "{\"project\": \"${PROJECT_NAME}\", \"job\": \"test\"}"

deploy-production:
  stage: deploy
  script:
    - |
      curl -X POST "${WEBHOOK_URL}/webhook" \
        -H "Content-Type: application/json" \
        -H "X-Webhook-Token: ${WEBHOOK_TOKEN}" \
        -d "{\"project\": \"${PROJECT_NAME}\", \"job\": \"deploy\"}"
  only:
    - main
  environment:
    name: production
```

**GitLab CI/CD Variables for Project A:**
1. Go to **Settings** > **CI/CD** > **Variables**
2. Add variables:
   - `WEBHOOK_URL` = `https://your-webhook-server.com`
   - `WEBHOOK_TOKEN` = (paste content of `keys/project-a-ci_public.pem`)
     - Mark as **Protected** and **Masked**

### For Project B Repository

In `project-b/.gitlab-ci.yml`:

```yaml
stages:
  - deploy

variables:
  PROJECT_NAME: "project-b"

deploy-api:
  stage: deploy
  script:
    - |
      curl -X POST "${WEBHOOK_URL}/webhook" \
        -H "Content-Type: application/json" \
        -H "X-Webhook-Token: ${WEBHOOK_TOKEN}" \
        -d "{\"project\": \"${PROJECT_NAME}\", \"job\": \"deploy\"}"
  only:
    - main
  when: manual
```

**GitLab CI/CD Variables for Project B:**
- `WEBHOOK_URL` = `https://your-webhook-server.com` (same server)
- `WEBHOOK_TOKEN` = (paste content of `keys/project-b-ci_public.pem`)
  - Mark as **Protected** and **Masked**

## Step 10: Monitor Logs

```bash
# Watch all logs
tail -f logs/combined.log

# Or watch server console for real-time output
```

## Architecture Summary

```
┌─────────────────┐
│  Project A Repo │
│   (GitLab CI)   │
└────────┬────────┘
         │ project-a-ci public key
         │
         v
┌────────────────────────┐       ┌──────────────┐
│   Webhook Server       │───────│ project-a/   │
│ ┌────────────────────┐ │       │ ├─ deploy.sh │
│ │ Authentication     │ │       │ └─ test.sh   │
│ │ Project Validation │ │       └──────────────┘
│ │ Job Execution      │ │
│ └────────────────────┘ │       ┌──────────────┐
└────────┬───────────────┘       │ project-b/   │
         │                       │ └─ deploy.sh │
         │ project-b-ci public key    └──────────────┘
         v
┌─────────────────┐
│  Project B Repo │
│   (GitLab CI)   │
└─────────────────┘
```

## Security Benefits

✅ **Project Isolation**: Project A cannot execute Project B jobs
✅ **Key-based Auth**: Each project has unique credentials
✅ **Audit Trail**: All job executions logged with project/client info
✅ **Access Control**: Server enforces project assignments
✅ **Fail-Safe**: Invalid requests rejected before job execution

## Adding More Projects

```bash
# 1. Create project directory and jobs
mkdir -p jobs/project-c
echo '#!/bin/bash\necho "Running job..."' > jobs/project-c/build.sh
chmod +x jobs/project-c/build.sh

# 2. Generate client keypair
node scripts/generateKeys.js project-c-ci

# 3. Authorize client
node scripts/addAuthorizedKey.js ./keys/project-c-ci_public.pem "Project C CI"

# 4. Assign to project
node scripts/manageClientProjects.js assign \
  ./keys/project-c-ci_public.pem \
  "project-c" \
  "Project C CI Pipeline"

# 5. Use project-c-ci_public.pem in Project C's GitLab CI variables
```

## Cleanup

```bash
# Remove client assignment
node scripts/manageClientProjects.js remove ./keys/project-a-ci_public.pem

# Remove authorized key (manual edit)
# Edit config/authorized_keys.txt and remove the key

# Delete project jobs
rm -rf jobs/project-a
```
